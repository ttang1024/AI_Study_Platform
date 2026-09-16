/**
 * Behavioural cover for the TTS queue shared by web/ and rn/ (@core/react/ttsQueue).
 *
 * The queue itself is platform-agnostic, but exercising it needs a DOM for React,
 * and web/ is the deployable that already has one — hence the tests living here
 * rather than in packages/core, whose vitest runs in a node environment. Nothing
 * below touches a browser API: playback goes through a fake TtsAudioDriver, which
 * is exactly the seam the two real drivers implement.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createUseTts,
  type TtsAudioDriver,
  type TtsAudioHandle,
  type TtsChunkCallbacks,
} from '@core/react/ttsQueue';
import type { TtsItem } from '@core/tts';

const ITEMS: TtsItem[] = [
  { title: 'First', text: 'first text' },
  { title: 'Second', text: 'second text' },
];

interface OpenedChunk {
  source: string;
  callbacks: TtsChunkCallbacks;
  handle: TtsAudioHandle & { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };
}

function harness(options: {
  chunksFor?: (text: string) => string[];
  failOpen?: boolean;
  synthesisRejects?: Error;
} = {}) {
  const opened: OpenedChunk[] = [];
  const discarded: string[][] = [];

  const driver: TtsAudioDriver = {
    open(source, callbacks) {
      if (options.failOpen) return null;
      const handle = { pause: vi.fn(), resume: vi.fn(), release: vi.fn() };
      opened.push({ source, callbacks, handle });
      return handle;
    },
    discard(sources) { discarded.push([...sources]); },
  };

  const synthesize = vi.fn(async (text: string) => {
    if (options.synthesisRejects) throw options.synthesisRejects;
    return options.chunksFor ? options.chunksFor(text) : [`${text}/0`];
  });

  const useTts = createUseTts({
    synthesize,
    driver,
    synthesisErrorMessage: 'fallback message',
    errorCode: 'api_error',
  });

  return { useTts, opened, discarded, synthesize };
}

/** Plays from `index` and waits for the first chunk to reach the driver. */
async function play(result: { current: ReturnType<ReturnType<typeof harness>['useTts']> }, index?: number) {
  await act(async () => { result.current.play(index); });
}

describe('shared TTS queue', () => {
  it('synthesizes the item it was asked for and plays its chunks in order', async () => {
    const h = harness({ chunksFor: (t) => [`${t}/0`, `${t}/1`] });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);

    expect(h.synthesize).toHaveBeenCalledWith('first text', expect.anything());
    expect(h.opened.map((o) => o.source)).toEqual(['first text/0']);
    await waitFor(() => expect(result.current.playerState).toBe('playing'));

    // Ending chunk 0 should open chunk 1 rather than advancing the item.
    await act(async () => { h.opened[0].callbacks.onEnded(); });
    expect(h.opened.map((o) => o.source)).toEqual(['first text/0', 'first text/1']);
    expect(result.current.currentIndex).toBe(0);
  });

  it('advances to the next item once the last chunk ends', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await act(async () => { h.opened[0].callbacks.onEnded(); });

    await waitFor(() => expect(result.current.currentIndex).toBe(1));
    expect(h.synthesize).toHaveBeenLastCalledWith('second text', expect.anything());
  });

  it('stops when the final item finishes rather than running off the end', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 1);
    await act(async () => { h.opened[0].callbacks.onEnded(); });

    await waitFor(() => expect(result.current.playerState).toBe('idle'));
  });

  it('discards chunks it never reached when playback is interrupted', async () => {
    const h = harness({ chunksFor: (t) => [`${t}/0`, `${t}/1`, `${t}/2`] });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await act(async () => { result.current.stop(); });

    // Chunk 0 is playing and owns itself; 1 and 2 are still the queue's to free.
    expect(h.discarded).toContainEqual(['first text/1', 'first text/2']);
    expect(h.opened[0].handle.release).toHaveBeenCalled();
    expect(result.current.playerState).toBe('idle');
  });

  it('routes pause and resume to the playing chunk', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));
    await play(result, 0);

    await act(async () => { result.current.pause(); });
    expect(h.opened[0].handle.pause).toHaveBeenCalled();
    expect(result.current.playerState).toBe('paused');

    await act(async () => { result.current.resume(); });
    expect(h.opened[0].handle.resume).toHaveBeenCalled();
    expect(result.current.playerState).toBe('playing');
  });

  it('does not advance the queue after a pause', async () => {
    const h = harness({ chunksFor: (t) => [`${t}/0`, `${t}/1`] });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await act(async () => { result.current.pause(); });
    await act(async () => { h.opened[0].callbacks.onEnded(); });

    expect(h.opened).toHaveLength(1);
  });

  it('skips forward and back, clamping at the first item', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await act(async () => { result.current.skipForward(); });
    await waitFor(() => expect(result.current.currentIndex).toBe(1));

    await act(async () => { result.current.skipBack(); });
    await waitFor(() => expect(result.current.currentIndex).toBe(0));

    await act(async () => { result.current.skipBack(); });
    await waitFor(() => expect(result.current.currentIndex).toBe(0));
  });

  it('surfaces a synthesis failure with its message and configured code, then goes idle', async () => {
    const h = harness({ synthesisRejects: new Error('upstream exploded') });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);

    await waitFor(() => expect(result.current.ttsError).toEqual({
      code: 'api_error',
      message: 'upstream exploded',
    }));
    expect(result.current.playerState).toBe('idle');

    await act(async () => { result.current.clearError(); });
    expect(result.current.ttsError).toBeNull();
  });

  it('falls back to the configured message when the failure carries none', async () => {
    const h = harness({ synthesisRejects: new Error('') });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await waitFor(() => expect(result.current.ttsError?.message).toBe('fallback message'));
  });

  it('abandons the queue when a chunk cannot be opened at all', async () => {
    const h = harness({ failOpen: true });
    const { result } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    await waitFor(() => expect(result.current.playerState).toBe('idle'));
  });

  it('replaces the queue through setItems without restarting playback', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));

    const next: TtsItem[] = [{ title: 'Only', text: 'only text' }];
    await act(async () => { result.current.setItems(next); });

    expect(result.current.items).toEqual(next);
    expect(h.synthesize).not.toHaveBeenCalled();
  });

  it('stops playback when the component unmounts', async () => {
    const h = harness();
    const { result, unmount } = renderHook(() => h.useTts(ITEMS));

    await play(result, 0);
    unmount();

    expect(h.opened[0].handle.release).toHaveBeenCalled();
  });
});

describe('shared TTS sleep timer', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('counts down and stops playback when it expires', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));
    await act(async () => { result.current.play(0); });

    await act(async () => { result.current.setSleepTimer(1); });
    expect(result.current.hasSleepTimer).toBe(true);

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(result.current.sleepTimeLeft).toBe('0:59');

    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(result.current.playerState).toBe('idle');
    expect(result.current.hasSleepTimer).toBe(false);
    expect(result.current.sleepTimeLeft).toBeNull();
  });

  it('cancels cleanly without touching playback', async () => {
    const h = harness();
    const { result } = renderHook(() => h.useTts(ITEMS));
    await act(async () => { result.current.play(0); });
    await waitFor(() => expect(result.current.playerState).toBe('playing'));

    await act(async () => { result.current.setSleepTimer(5); });
    await act(async () => { result.current.cancelSleepTimer(); });

    expect(result.current.hasSleepTimer).toBe(false);
    expect(result.current.sleepTimeLeft).toBeNull();
    expect(result.current.playerState).toBe('playing');
  });
});
