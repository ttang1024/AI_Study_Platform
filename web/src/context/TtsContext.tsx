import { createTtsContext } from '@core/react/ttsContext';
import { TtsPlayer } from '../components/common/TtsPlayer';
import { useTts } from '../hooks/useTts';

// The provider and hook themselves are shared with rn — see @core/react/ttsContext.
// All that differs here is the browser's transport bar and the browser's useTts.
export const { TtsProvider, usePersistentTts } = createTtsContext({
  useTts,
  PlayerComponent: TtsPlayer,
});
