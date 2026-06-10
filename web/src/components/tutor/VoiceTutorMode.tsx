import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap, Mic, MicOff, Send, Loader2, Volume2, VolumeX, MessageSquare, RotateCcw,
} from 'lucide-react';
import { aiService } from '../../services/aiService';
import { synthesizeSpeech } from '../../services/edgeTtsService';
import { ChatMarkdown, markdownToPlainText } from '../ai/ChatMarkdown';
import { useDictation } from './useDictation';
import { cn } from '../../utils/cn';

interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
}

// The voice tutor persists its Q&A into a regular chat conversation, so history
// survives reloads and also shows up under the AI Chat conversation list.
const CONVERSATION_STORAGE_KEY = 'voice_tutor_conversation_id';

/** Spoken Q&A tutor: speech input (where supported) + TTS replies, backed by a persistent conversation. */
export const VoiceTutorMode: React.FC = () => {
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const conversationIdRef = useRef<string | null>(localStorage.getItem(CONVERSATION_STORAGE_KEY));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { listening, toggle, supported } = useDictation((text) => setInput(text));

  // Restore the previous session's transcript. A stale/foreign conversation id
  // (deleted, or another account on this browser) 404s — drop it and start fresh.
  useEffect(() => {
    const conversationId = conversationIdRef.current;
    if (!conversationId) { setHistoryLoading(false); return; }
    aiService.getGeneralChatHistory(conversationId)
      .then((history) => {
        setMessages(history.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })));
      })
      .catch(() => {
        conversationIdRef.current = null;
        localStorage.removeItem(CONVERSATION_STORAGE_KEY);
      })
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  // Stop any in-flight speech when leaving the page.
  useEffect(() => () => audioRef.current?.pause(), []);

  const startNewSession = () => {
    audioRef.current?.pause();
    conversationIdRef.current = null;
    localStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setMessages([]);
  };

  const speak = async (text: string) => {
    try {
      const urls = await synthesizeSpeech(text);
      const playNext = (i: number) => {
        if (i >= urls.length) return;
        const audio = new Audio(urls[i]);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(urls[i]); playNext(i + 1); };
        void audio.play();
      };
      playNext(0);
    } catch { /* TTS is best-effort */ }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || thinking) return;
    if (listening) toggle();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setThinking(true);
    try {
      if (!conversationIdRef.current) {
        const conversation = await aiService.createGeneralChatConversation();
        conversationIdRef.current = conversation.conversationId;
        localStorage.setItem(CONVERSATION_STORAGE_KEY, conversation.conversationId);
      }

      // Stream the reply into a live assistant bubble; the server persists both sides.
      let reply = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
      await aiService.streamGeneralChatConversation(conversationIdRef.current, message, (chunk) => {
        reply += chunk;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: reply };
          return next;
        });
      });
      if (speakReplies && reply) void speak(markdownToPlainText(reply));
    } catch {
      setMessages((prev) => {
        const next = prev[prev.length - 1]?.role === 'assistant' && !prev[prev.length - 1].content
          ? prev.slice(0, -1)
          : prev;
        return [...next, { role: 'assistant', content: 'Sorry, something went wrong — try again.' }];
      });
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl flex flex-col" style={{ minHeight: 520 }}>
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
        <MessageSquare size={15} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Voice tutor</h2>
        {messages.length > 0 && (
          <button
            onClick={startNewSession}
            className="ml-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
            title="Start a fresh session (the old one stays under Conversations)"
          >
            <RotateCcw size={12} /> New session
          </button>
        )}
        <button
          onClick={() => { setSpeakReplies((v) => !v); audioRef.current?.pause(); }}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors',
            speakReplies ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500',
          )}
          title={speakReplies ? 'Spoken replies on' : 'Spoken replies off'}
        >
          {speakReplies ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {speakReplies ? 'Speaking' : 'Muted'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {historyLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 size={18} className="animate-spin text-gray-300" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-10">
            <GraduationCap size={28} className="text-teal-300" />
            <p className="text-sm text-gray-500 max-w-sm">
              Have a spoken Q&A session with your tutor. {supported
                ? 'Tap the mic, ask a question out loud, and the tutor answers back — with voice.'
                : 'Your browser lacks speech input — type below and replies are read aloud.'}
            </p>
          </div>
        ) : messages.filter((m) => m.content || m.role === 'user').map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
              m.role === 'user'
                ? 'bg-teal-600 text-white rounded-br-sm whitespace-pre-wrap'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm',
            )}>
              {m.role === 'assistant' ? <ChatMarkdown>{m.content}</ChatMarkdown> : m.content}
            </div>
          </div>
        ))}
        {thinking && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-2xl rounded-bl-sm">
              <Loader2 size={14} className="animate-spin text-gray-400" />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
        {supported && (
          <button
            onClick={toggle}
            className={cn(
              'flex items-center justify-center w-10 h-10 rounded-xl border transition-colors',
              listening ? 'border-red-300 bg-red-50 text-red-500 animate-pulse' : 'border-gray-200 text-gray-500 hover:bg-gray-50',
            )}
            title={listening ? 'Stop listening' : 'Speak'}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(input); } }}
          placeholder={listening ? 'Listening…' : 'Ask your tutor anything…'}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
        />
        <button
          onClick={() => void send(input)}
          disabled={!input.trim() || thinking}
          className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
