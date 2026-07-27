import { StyleSheet, View, useWindowDimensions } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

import { Radius, Spacing } from '@/constants/theme';
import { shareMediaUrl, type SharedContent } from '@/services/shareService';
import { SharedAudioPlayer, SharedUploadedVideo } from './sharedMediaPlayers';

interface Props {
  content: SharedContent;
  sourceType: string | null;
  youTubeId: string | null;
}

/** Audio player / uploaded-video player / YouTube embed — whichever applies to this share. */
export function SharedContentMedia({ content, sourceType, youTubeId }: Props) {
  const { width } = useWindowDimensions();

  if (sourceType === 'audio' || sourceType === 'podcast') {
    return <SharedAudioPlayer url={shareMediaUrl(content.token, 'audio')} />;
  }
  if (sourceType === 'upload') {
    return (
      <View style={styles.videoBox}>
        <SharedUploadedVideo url={shareMediaUrl(content.token, 'video')} width={width - Spacing.three * 2} />
      </View>
    );
  }
  if (youTubeId) {
    return (
      <View style={styles.videoBox}>
        <YoutubePlayer height={((width - Spacing.three * 2) * 9) / 16} width={width - Spacing.three * 2} videoId={youTubeId} />
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  videoBox: { borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' },
});
