import { useEffect, useRef, useState, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import * as Y from 'yjs';
import { getApiUrl } from '../utils/env';
import groupNotesService from '../services/groupNotesService';

export interface NotePeer {
  connectionId: string;
  name: string;
  color: string;
}

const PEER_COLORS = ['#f97316', '#8b5cf6', '#0ea5e9', '#ec4899', '#22c55e', '#eab308'];
const colorFor = (seed: string) => PEER_COLORS[Math.abs(hashCode(seed)) % PEER_COLORS.length];
function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

const SAVE_DEBOUNCE_MS = 1500;
const AWARENESS_THROTTLE_MS = 400;

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Replaces the differing middle span between old and new text — the standard Yjs+textarea binding. */
function applyTextDiff(ytext: Y.Text, oldText: string, newText: string) {
  if (oldText === newText) return;
  let start = 0;
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  if (oldEnd > start) ytext.delete(start, oldEnd - start);
  if (newEnd > start) ytext.insert(start, newText.slice(start, newEnd));
}

interface UseCollaborativeNoteResult {
  text: string;
  setText: (next: string) => void;
  peers: NotePeer[];
  connected: boolean;
  saving: boolean;
}

/**
 * Binds a plain-text note to a Yjs CRDT document synced over the group-chat SignalR hub.
 * The server relays raw update bytes between clients and persists debounced full-state
 * snapshots — it never interprets the CRDT itself, so merges are always conflict-free.
 */
export function useCollaborativeNote(noteId: string | null, myName: string): UseCollaborativeNoteResult {
  const [text, setTextState] = useState('');
  const [peers, setPeers] = useState<NotePeer[]>([]);
  const [connected, setConnected] = useState(false);
  const [saving, setSaving] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const hubRef = useRef<signalR.HubConnection | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awarenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef('');

  useEffect(() => {
    if (!noteId) return;

    const doc = new Y.Doc();
    const ytext = doc.getText('content');
    docRef.current = doc;
    ytextRef.current = ytext;

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${getApiUrl()}/hubs/group-chat`, {
        accessTokenFactory: () => localStorage.getItem('sp_access_token') ?? '',
      })
      .withAutomaticReconnect()
      .build();
    hubRef.current = connection;

    const syncTextState = () => {
      const value = ytext.toString();
      lastTextRef.current = value;
      setTextState(value);
    };

    connection.on('ReceiveNoteUpdate', (updateBase64: string) => {
      Y.applyUpdate(doc, fromBase64(updateBase64), 'remote');
    });

    connection.on('ReceiveNoteAwareness', (awarenessBase64: string) => {
      try {
        const payload = JSON.parse(atob(awarenessBase64)) as NotePeer;
        setPeers(prev => {
          const rest = prev.filter(p => p.connectionId !== payload.connectionId);
          return [...rest, payload];
        });
      } catch { /* ignore malformed awareness */ }
    });

    connection.on('NotePeerLeft', (connectionId: string) => {
      setPeers(prev => prev.filter(p => p.connectionId !== connectionId));
    });

    // Local edits produce an 'update' event; only broadcast ones we originated.
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      syncTextState();
      if (origin === 'remote') return;
      connection.invoke('SendNoteUpdate', noteId, toBase64(update)).catch(() => { });
      scheduleSave();
    });

    const scheduleSave = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSaving(true);
        const state = toBase64(Y.encodeStateAsUpdate(doc));
        const preview = ytext.toString().slice(0, 500);
        connection.invoke('SaveNoteState', noteId, state, preview)
          .catch(() => { })
          .finally(() => setSaving(false));
      }, SAVE_DEBOUNCE_MS);
    };

    const joinAndHydrate = async () => {
      setConnected(true);
      const hydrateBase64: string = await connection.invoke('JoinNote', noteId);
      if (hydrateBase64) {
        Y.applyUpdate(doc, fromBase64(hydrateBase64), 'remote');
      } else {
        // Brand-new note: fall back to the REST snapshot in case the hub state is stale.
        try {
          const { data } = await groupNotesService.getNote(noteId);
          const remoteState = data.data.stateBase64;
          if (remoteState) Y.applyUpdate(doc, fromBase64(remoteState), 'remote');
        } catch { /* leave empty */ }
      }
      syncTextState();
      broadcastAwareness();
    };

    // A reconnect gets a brand-new connection id, and hub group membership is per connection — so
    // without re-joining, the editor looks connected while no peer edits arrive. Re-hydrating is
    // safe: Yjs updates merge idempotently, so this also catches up on edits missed while offline.
    connection.onreconnected(() => {
      joinAndHydrate().catch(() => setConnected(false));
    });
    connection.onreconnecting(() => setConnected(false));

    connection.start()
      .then(joinAndHydrate)
      .catch(() => setConnected(false));

    const broadcastAwareness = () => {
      const payload: NotePeer = {
        connectionId: connection.connectionId ?? 'me',
        name: myName,
        color: colorFor(myName),
      };
      const encoded = btoa(JSON.stringify(payload));
      connection.invoke('SendNoteAwareness', noteId, encoded).catch(() => { });
    };

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (awarenessTimerRef.current) clearTimeout(awarenessTimerRef.current);
      connection.invoke('LeaveNote', noteId).catch(() => { });
      connection.stop();
      doc.destroy();
      hubRef.current = null;
      docRef.current = null;
      ytextRef.current = null;
      setConnected(false);
      setPeers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const setText = useCallback((next: string) => {
    const ytext = ytextRef.current;
    const doc = docRef.current;
    if (!ytext || !doc) return;
    doc.transact(() => applyTextDiff(ytext, lastTextRef.current, next));

    // Re-broadcast presence on activity so peers see you're still around.
    if (awarenessTimerRef.current) clearTimeout(awarenessTimerRef.current);
    awarenessTimerRef.current = setTimeout(() => {
      const connection = hubRef.current;
      if (!connection || !noteId) return;
      const payload: NotePeer = { connectionId: connection.connectionId ?? 'me', name: myName, color: colorFor(myName) };
      connection.invoke('SendNoteAwareness', noteId, btoa(JSON.stringify(payload))).catch(() => { });
    }, AWARENESS_THROTTLE_MS);
  }, [noteId, myName]);

  return { text, setText, peers, connected, saving };
}
