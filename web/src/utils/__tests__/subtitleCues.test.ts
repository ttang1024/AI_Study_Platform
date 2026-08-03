import { describe, it, expect } from 'vitest';
import { parseCues, isSubtitleFile } from '../subtitleCues';

describe('parseCues', () => {
  it('reads srt cues with their timings', () => {
    const srt = '1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:01:05,000 --> 00:01:07,000\nSecond <i>line</i>\n';
    const cues = parseCues(srt, 'lecture.srt');

    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: '0:01', end: '0:04', text: 'Hello world' });
    expect(cues[1].text).toBe('Second line');
    expect(cues[1].start).toBe('1:05');
  });

  it('joins multi-line srt cue text', () => {
    const cues = parseCues('1\n00:00:01,000 --> 00:00:04,000\nfirst\nsecond\n', 'a.srt');
    expect(cues[0].text).toBe('first\nsecond');
  });

  it('drops the WEBVTT header and NOTE blocks', () => {
    const vtt = 'WEBVTT\n\nNOTE a comment\n\n00:00.000 --> 00:04.000\n<v Speaker>Hi there\n';
    const cues = parseCues(vtt, 'talk.vtt');

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('Hi there');
  });

  it('reads comma-separated sbv timings', () => {
    const cues = parseCues('0:00:01.000,0:00:04.000\nFirst\n\n0:00:04.000,0:00:08.000\nSecond\n', 'a.sbv');

    expect(cues.map(c => c.text)).toEqual(['First', 'Second']);
    expect(cues[0].start).toBe('0:01');
  });

  it('strips ASS override tags and keeps commas in dialogue', () => {
    const ass = 'Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\\i1}Hello{\\i0}, world\n';
    const cues = parseCues(ass, 'a.ass');

    expect(cues[0].text).toBe('Hello, world');
  });

  it('turns lrc timestamps into cue starts and skips metadata', () => {
    const cues = parseCues('[ar:Artist]\n[00:12.34]First lyric\n', 'song.lrc');

    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe('First lyric');
    expect(cues[0].start).toBe('0:12');
  });

  it('reads ttml paragraphs and line breaks', () => {
    const ttml = `<?xml version="1.0"?>
      <tt xmlns="http://www.w3.org/ns/ttml"><body><div>
        <p begin="00:00:01.000" end="00:00:04.000">Hello <span>there</span></p>
        <p begin="00:00:04.000" end="00:00:08.000">Second<br/>line</p>
      </div></body></tt>`;
    const cues = parseCues(ttml, 'captions.ttml');

    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe('Hello there');
    expect(cues[0].start).toBe('0:01');
    expect(cues[1].text).toBe('Second\nline');
  });

  it('strips MicroDVD frame markers', () => {
    expect(parseCues('{100}{200}Hello|World\n', 'a.sub')[0].text).toBe('Hello\nWorld');
  });

  it('returns nothing for content that has no cues, so the caller can fall back', () => {
    expect(parseCues('not a subtitle file at all', 'a.ttml')).toEqual([]);
  });
});

describe('isSubtitleFile', () => {
  it('recognises the caption extensions', () => {
    expect(isSubtitleFile('a.VTT')).toBe(true);
    expect(isSubtitleFile('a.dfxp')).toBe(true);
    expect(isSubtitleFile('a.txt')).toBe(false);
  });
});
