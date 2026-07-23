import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Check from 'lucide-react-native/icons/check';
import Info from 'lucide-react-native/icons/info';

import { Button } from '@/components/Button';
import { Alpha, Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { ttsSettingsService, type TtsSettings } from '@/services/ttsSettingsService';

// Voice IDs mirror web/src/components/settings/VoiceTab.tsx (Microsoft Edge
// neural voices — free, no API key required).
const VOICE_GROUPS: { label: string; voices: { id: string; label: string }[] }[] = [
  {
    label: 'English',
    voices: [
      { id: 'en-US-AriaNeural', label: 'Aria (US Female)' },
      { id: 'en-US-GuyNeural', label: 'Guy (US Male)' },
      { id: 'en-US-JennyNeural', label: 'Jenny (US Female)' },
      { id: 'en-GB-SoniaNeural', label: 'Sonia (UK Female)' },
      { id: 'en-GB-RyanNeural', label: 'Ryan (UK Male)' },
      { id: 'en-AU-NatashaNeural', label: 'Natasha (AU Female)' },
    ],
  },
  {
    label: 'Chinese',
    voices: [
      { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (Mainland Female)' },
      { id: 'zh-CN-YunxiNeural', label: '云希 (Mainland Male)' },
      { id: 'zh-CN-XiaoyiNeural', label: '晓伊 (Mainland Female)' },
      { id: 'zh-CN-YunyangNeural', label: '云扬 (Mainland Male)' },
      { id: 'zh-TW-HsiaoChenNeural', label: '曉臻 (Taiwan Female)' },
      { id: 'zh-HK-HiuGaaiNeural', label: '曉佳 (HK Female)' },
    ],
  },
  {
    label: 'Japanese',
    voices: [
      { id: 'ja-JP-NanamiNeural', label: 'Nanami (JP Female)' },
      { id: 'ja-JP-KeitaNeural', label: 'Keita (JP Male)' },
    ],
  },
  {
    label: 'Korean',
    voices: [
      { id: 'ko-KR-SunHiNeural', label: 'SunHi (KR Female)' },
      { id: 'ko-KR-InJoonNeural', label: 'InJoon (KR Male)' },
    ],
  },
  {
    label: 'French',
    voices: [
      { id: 'fr-FR-DeniseNeural', label: 'Denise (FR Female)' },
      { id: 'fr-FR-HenriNeural', label: 'Henri (FR Male)' },
    ],
  },
  {
    label: 'Spanish',
    voices: [
      { id: 'es-ES-ElviraNeural', label: 'Elvira (ES Female)' },
      { id: 'es-MX-DaliaNeural', label: 'Dalia (MX Female)' },
    ],
  },
  {
    label: 'German',
    voices: [
      { id: 'de-DE-KatjaNeural', label: 'Katja (DE Female)' },
      { id: 'de-DE-ConradNeural', label: 'Conrad (DE Male)' },
    ],
  },
];

export default function VoiceSettingsScreen() {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [settings, setSettings] = useState<TtsSettings>({ voice: 'en-US-AriaNeural' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    ttsSettingsService.load().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await ttsSettingsService.save(settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
      <Text style={styles.hint}>
        Uses Microsoft Edge TTS for free, high-quality neural speech. No API key required.
      </Text>

      {VOICE_GROUPS.map((group) => (
        <View key={group.label} style={styles.section}>
          <Text style={styles.sectionTitle}>{group.label}</Text>
          {group.voices.map((voice) => {
            const active = settings.voice === voice.id;
            return (
              <Pressable
                key={voice.id}
                style={[styles.voiceRow, active && styles.voiceRowActive]}
                onPress={() => { setSuccess(false); setSettings({ voice: voice.id }); }}
              >
                <Text style={[styles.voiceLabel, active && styles.voiceLabelActive]}>{voice.label}</Text>
                {active && <Check size={16} color={Colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.infoBox}>
        <Info size={14} color={Colors.primary} />
        <Text style={styles.infoText}>
          Powered by Microsoft Edge neural voices. Free to use with no usage limits.
        </Text>
      </View>

      {success && <Text style={styles.successText}>Voice settings saved.</Text>}

      <Button title="Save" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  center: { ...Layout.fillCenter, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hint: { fontSize: 12, color: Colors.textSecondary },

  section: { gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  voiceRow: {
    ...Layout.rowBetween, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    backgroundColor: Colors.bgSidebar, paddingHorizontal: 14, paddingVertical: 12,
  },
  voiceRowActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.wash}` },
  voiceLabel: { fontSize: 14, color: Colors.textPrimary },
  voiceLabelActive: { fontWeight: '700', color: Colors.primary },

  infoBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    padding: Spacing.two, borderRadius: Radius.md,
    backgroundColor: Colors.zinc200, borderWidth: 1, borderColor: Colors.zinc300,
  },
  infoText: { flex: 1, fontSize: 10, lineHeight: 14, color: Colors.textSecondary },
  successText: { fontSize: 12, fontWeight: '600', color: Colors.emerald },
});
