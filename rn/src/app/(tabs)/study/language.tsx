import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Mic from 'lucide-react-native/icons/mic';
import Square from 'lucide-react-native/icons/square';
import X from 'lucide-react-native/icons/x';

import { Button } from '@/components/Button';
import { TabChipRow, type TabChipOption } from '@/components/TabChipRow';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { languageService, type PronunciationResult } from '@/services/languageService';

type Tab = 'speak' | 'mine';

const TAB_OPTIONS: Record<Tab, TabChipOption<Tab>> = {
  speak: { id: 'speak', label: 'Pronunciation', icon: Mic },
  mine: { id: 'mine', label: 'Sentence mining', icon: Check },
};

export default function LanguageScreen() {
  const [tab, setTab] = useState<Tab>('speak');

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TabChipRow tabs={[TAB_OPTIONS.speak, TAB_OPTIONS.mine]} active={tab} onChange={setTab} />
      <ScrollView contentContainerStyle={styles.content}>
        {tab === 'speak' ? <PronunciationPractice /> : <SentenceMining />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PronunciationPractice: React.FC = () => {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);

  const [phrase, setPhrase] = useState('');
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [error, setError] = useState('');

  const start = async () => {
    setError('');
    setResult(null);

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setError('Microphone access was refused, so there is nothing to score.');
      return;
    }

    // allowsRecording must be set before preparing, or iOS records silence.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopAndScore = async () => {
    await recorder.stop();

    const uri = recorder.uri;
    if (!uri) {
      setError('That recording came back empty. Try again.');
      return;
    }

    setScoring(true);
    try {
      setResult(await languageService.scorePronunciation(uri, phrase));
    } catch {
      setError('Could not score that recording.');
    } finally {
      setScoring(false);
      // Release the audio session so playback elsewhere in the app is not routed oddly afterwards.
      await setAudioModeAsync({ allowsRecording: false });
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Phrase to say</Text>
      <TextInput
        value={phrase}
        onChangeText={setPhrase}
        placeholder="e.g. ¿Dónde está la estación?"
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
      />

      {recorderState.isRecording ? (
        <Pressable style={[styles.recordButton, styles.stopButton]} onPress={stopAndScore}>
          <Square size={16} color={Colors.white} />
          <Text style={styles.recordText}>Stop and check</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.recordButton, (!phrase.trim() || scoring) && styles.disabled]}
          onPress={start}
          disabled={!phrase.trim() || scoring}
        >
          {scoring ? <ActivityIndicator size="small" color={Colors.white} /> : <Mic size={16} color={Colors.white} />}
          <Text style={styles.recordText}>{scoring ? 'Checking…' : 'Record'}</Text>
        </Pressable>
      )}

      {recorderState.isRecording && <Text style={styles.caption}>Listening…</Text>}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.score}>{result.score}%</Text>
          <Text style={styles.caption}>of the words came through clearly</Text>

          {/* Per-word marks are the actionable part: one number tells a learner nothing about which
              word to work on. */}
          <View style={styles.words}>
            {result.words.map((w, i) => (
              <View key={i} style={[styles.word, w.correct ? styles.wordGood : styles.wordBad]}>
                {w.correct ? (
                  <Check size={11} color={Colors.emerald} />
                ) : (
                  <X size={11} color={Colors.red} />
                )}
                <Text style={styles.wordText}>{w.word}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.caption}>
            Heard: “{result.heard || '—'}”. This checks whether a speech recogniser made out the right
            words — a useful proxy for intelligibility, not a judgement of your accent.
          </Text>
        </View>
      )}
    </View>
  );
};

const SentenceMining: React.FC = () => {
  const [sentence, setSentence] = useState('');
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await languageService.mineSentence({
        sentence,
        targetWord: word,
        meaning: meaning.trim() || undefined,
      });
      setMessage('Added to your reviews.');
      setSentence('');
      setWord('');
      setMeaning('');
    } catch {
      setError('Could not create that card — check the word appears in the sentence.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.caption}>
        Paste a sentence you met and choose the word to learn. It becomes a cloze card in your normal
        review schedule, so you meet the word again in the sentence you found it in.
      </Text>

      <TextInput
        value={sentence}
        onChangeText={setSentence}
        placeholder="The sentence, exactly as you met it"
        placeholderTextColor={Colors.textSecondary}
        multiline
        style={[styles.input, styles.multiline]}
      />
      <TextInput
        value={word}
        onChangeText={setWord}
        placeholder="Word to blank out"
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
      />
      <TextInput
        value={meaning}
        onChangeText={setMeaning}
        placeholder="Meaning (optional)"
        placeholderTextColor={Colors.textSecondary}
        style={styles.input}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!message && <Text style={styles.success}>{message}</Text>}

      <Button
        title={busy ? 'Adding…' : 'Add card'}
        onPress={submit}
        disabled={busy || !sentence.trim() || !word.trim()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  section: { gap: Spacing.two },
  label: { ...Typography.bodyBold, color: Colors.textPrimary },
  caption: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 19 },
  error: { ...Typography.caption, color: Colors.red },
  success: { ...Typography.caption, color: Colors.emerald },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.two, paddingVertical: Spacing.two,
    color: Colors.textPrimary, backgroundColor: Colors.bgSidebar,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  recordButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: Spacing.two, borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  stopButton: { backgroundColor: Colors.red },
  disabled: { opacity: 0.5 },
  recordText: { ...Typography.bodyBold, color: Colors.white },
  resultCard: {
    gap: Spacing.two, padding: Spacing.three, marginTop: Spacing.two,
    borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar,
  },
  score: { ...Typography.title, color: Colors.textPrimary },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  word: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.one, paddingVertical: 4, borderRadius: Radius.sm,
  },
  wordGood: { backgroundColor: `${Colors.emerald}22` },
  wordBad: { backgroundColor: `${Colors.red}22` },
  wordText: { ...Typography.caption, color: Colors.textPrimary },
});
