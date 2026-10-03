import { useVideoPlayer, VideoView } from 'expo-video';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

import { Colors } from '@/constants/theme';
import { videoService } from '@/services/videoService';
import type { SeekHandle } from '@/components/library/videoDetailMeta';

export const UploadedVideoPlayer = forwardRef<SeekHandle, { videoRecordId: string; width: number; height: number }>(
  ({ videoRecordId, width, height }, ref) => {
    const [streamUrl, setStreamUrl] = useState<string | null>(null);

    useEffect(() => {
      videoService.getUploadedVideoStreamUrl(videoRecordId).then(setStreamUrl);
    }, [videoRecordId]);

    const player = useVideoPlayer(streamUrl ? { uri: streamUrl } : null, (p) => {
      p.loop = false;
    });

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        player.currentTime = seconds;
        player.play();
      },
    }), [player]);

    if (!streamUrl) return <ActivityIndicator color={Colors.primary} style={{ height }} />;

    return (
      <VideoView
        style={{ width, height }}
        player={player}
        nativeControls
        fullscreenOptions={{ enable: true }}
      />
    );
  },
);
UploadedVideoPlayer.displayName = 'UploadedVideoPlayer';

export const YoutubeEmbeddedPlayer = forwardRef<SeekHandle, { videoId: string; width: number; height: number }>(
  ({ videoId, width, height }, ref) => {
    const [playing, setPlaying] = useState(true);
    const playerRef = useRef<React.ElementRef<typeof YoutubePlayer>>(null);

    const onChangeState = useCallback((state: string) => {
      if (state === 'ended') setPlaying(false);
    }, []);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        playerRef.current?.seekTo(seconds, true);
        setPlaying(true);
      },
    }), []);

    return (
      <YoutubePlayer
        ref={playerRef}
        height={height}
        width={width}
        videoId={videoId}
        play={playing}
        onChangeState={onChangeState}
      />
    );
  },
);
YoutubeEmbeddedPlayer.displayName = 'YoutubeEmbeddedPlayer';
