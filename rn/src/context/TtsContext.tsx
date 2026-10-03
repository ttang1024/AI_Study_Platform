import { createTtsContext } from '@core/react/ttsContext';
import { TtsPlayerBar } from '@/components/tts/TtsPlayerBar';
import { useTts } from '@/hooks/useTts';

// The provider and hook themselves are shared with web — see @core/react/ttsContext.
// All that differs here is the native transport bar and the native useTts.
export const { TtsProvider, usePersistentTts } = createTtsContext({
  useTts,
  PlayerComponent: TtsPlayerBar,
});
