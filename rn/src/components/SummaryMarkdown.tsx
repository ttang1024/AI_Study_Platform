import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Markdown from 'react-native-markdown-display';

import { MathMarkdown } from '@/components/MathMarkdown';
import { Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { containsTexMath } from '@/utils/mathMarkdownHtml';
import { formatTimecode } from '@core/utils/format';

const markdownStyles = {
  body: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21 },
  heading1: { color: Colors.primary, fontSize: 13, fontWeight: '800' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: Spacing.two, marginBottom: Spacing.one },
  heading2: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' as const, marginTop: Spacing.three, marginBottom: Spacing.one },
  heading3: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' as const, marginTop: Spacing.two, marginBottom: Spacing.one },
  strong: { fontWeight: '700' as const, color: Colors.textPrimary },
  bullet_list: { marginTop: Spacing.one },
  ordered_list: { marginTop: Spacing.one },
  list_item: { marginBottom: Spacing.half },
  code_inline: { backgroundColor: Colors.zinc200, borderRadius: 4, paddingHorizontal: 4 },
  code_block: { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, padding: Spacing.two },
  fence: { backgroundColor: '#18181b', color: '#f4f4f5', borderRadius: 12, padding: Spacing.two },
  blockquote: { borderLeftColor: Colors.primary, borderLeftWidth: 3, paddingLeft: Spacing.two, opacity: 0.85 },
};

// Renders plain markdown. Math-bearing content goes through the KaTeX WebView;
// everything else keeps the cheaper native renderer (react-native-markdown-display
// has no math support).
const BaseMarkdown: React.FC<{ value: string }> = ({ value }) =>
  containsTexMath(value)
    ? <MathMarkdown value={value} />
    : <Markdown style={markdownStyles}>{value}</Markdown>;

// Mirrors web/src/components/study/SummaryMarkdown.tsx: the AI timeline prompt
// emits "MM:SS – MM:SS Description" ranges (optionally as a bullet, sometimes with
// the description folded onto the next line). We turn each into a clickable /
// scrubbable segment so tapping the range — or dragging the slider — seeks the video.
const timelineRangePattern = /^\s*(?:[-*]\s*)?(\d{1,2}:\d{2}(?::\d{2})?)\s*[–—-]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*(.*)$/;

type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'timeline'; start: string; end: string; body: string };

const cleanTimelineBody = (body: string): string => body.replace(/^\s*[:\-–]\s*/, '').trim();

const parseTimestamp = (value: string): number => {
  const parts = value.split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
};

const formatTimestamp = (seconds: number): string => formatTimecode(seconds, { padMinutes: true });

const parseSegments = (value: string): Segment[] => {
  const lines = value.split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join('\n').trim();
    if (text) segments.push({ kind: 'markdown', text });
    buffer = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(timelineRangePattern);
    if (!match) {
      buffer.push(lines[i]);
      continue;
    }
    flush();
    let body = match[3].trim();
    if (!body) {
      // Range with no inline description — fold in the next non-blank line, as long
      // as it isn't itself another range.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j < lines.length && !timelineRangePattern.test(lines[j])) {
        body = lines[j].trim();
        i = j;
      }
    }
    segments.push({ kind: 'timeline', start: match[1], end: match[2], body: cleanTimelineBody(body) });
  }
  flush();
  return segments;
};

const hasTimeline = (value: string): boolean =>
  value.split('\n').some((line) => timelineRangePattern.test(line));

const THUMB = 16;

const TimelineSegment: React.FC<{
  startLabel: string;
  endLabel: string;
  body: string;
  onSeek: (seconds: number) => void;
}> = ({ startLabel, endLabel, body, onSeek }) => {
  const startSeconds = parseTimestamp(startLabel);
  const endSeconds = Math.max(startSeconds, parseTimestamp(endLabel));

  // Seeded from the start of the range; the parent remounts this component when the
  // range changes (keyed on the timestamps), so no reset effect is needed.
  const [value, setValue] = useState(startSeconds);
  const [trackWidth, setTrackWidth] = useState(0);

  // Map a touch x-offset (relative to the track) to a second within the range.
  const valueFromX = (x: number): number => {
    if (trackWidth <= 0) return value;
    const ratio = Math.min(1, Math.max(0, x / trackWidth));
    return Math.round(startSeconds + ratio * (endSeconds - startSeconds));
  };

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const ratio = endSeconds > startSeconds ? (value - startSeconds) / (endSeconds - startSeconds) : 0;
  const fillWidth = ratio * trackWidth;

  return (
    <View style={styles.item}>
      <View style={styles.head}>
        <Pressable
          onPress={() => {
            setValue(startSeconds);
            onSeek(startSeconds);
          }}
          hitSlop={8}
        >
          <Text style={styles.range}>{startLabel} – {endLabel}</Text>
        </Pressable>
        <Text style={styles.current}>{formatTimestamp(value)}</Text>
      </View>

      {/* The View responder system (rather than PanResponder) keeps the handlers as
          plain render-scope closures — each drag frame re-renders with the new value,
          and release seeks to the exact touch position. */}
      <View
        style={styles.track}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => setValue(valueFromX(e.nativeEvent.locationX))}
        onResponderMove={(e) => setValue(valueFromX(e.nativeEvent.locationX))}
        onResponderRelease={(e) => {
          const next = valueFromX(e.nativeEvent.locationX);
          setValue(next);
          onSeek(next);
        }}
      >
        <View style={styles.trackLine} />
        <View style={[styles.trackFill, { width: fillWidth }]} />
        <View style={[styles.thumb, { left: Math.max(0, Math.min(trackWidth, fillWidth) - THUMB / 2) }]} />
      </View>

      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
};

interface SummaryMarkdownProps {
  value: string;
  /** When provided (and the summary has a "MM:SS – MM:SS" timeline), each range
   * becomes a clickable + draggable seek control that calls this with a second offset. */
  onTimelineSeek?: (seconds: number) => void;
}

export const SummaryMarkdown: React.FC<SummaryMarkdownProps> = ({ value, onTimelineSeek }) => {
  // Timeline scrubbing only applies to the plain native renderer; math summaries
  // (rendered in a WebView) and summaries without a timeline fall straight through.
  if (!onTimelineSeek || containsTexMath(value) || !hasTimeline(value)) {
    return <BaseMarkdown value={value} />;
  }

  const segments = parseSegments(value);
  return (
    <View>
      {segments.map((segment, index) =>
        segment.kind === 'timeline' ? (
          <TimelineSegment
            key={`${index}-${segment.start}-${segment.end}`}
            startLabel={segment.start}
            endLabel={segment.end}
            body={segment.body}
            onSeek={onTimelineSeek}
          />
        ) : (
          <BaseMarkdown key={index} value={segment.text} />
        ),
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    marginVertical: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgApp,
  },
  head: { ...Layout.rowBetween, gap: Spacing.two },
  range: { color: Colors.primary, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  current: { color: Colors.textSecondary, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 28, justifyContent: 'center', marginTop: Spacing.one, marginBottom: Spacing.half },
  trackLine: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: Colors.zinc300 },
  trackFill: { position: 'absolute', left: 0, height: 4, borderRadius: 2, backgroundColor: Colors.primary },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  body: { color: Colors.textPrimary, fontSize: 14, lineHeight: 21, marginTop: Spacing.one },
});
