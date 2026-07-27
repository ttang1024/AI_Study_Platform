import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Info from 'lucide-react-native/icons/info';
import Wifi from 'lucide-react-native/icons/wifi';

import { Button } from '@/components/Button';
import { InfoBanner } from '@/components/InfoBanner';
import { LoadingScreen } from '@/components/LoadingScreen';
import { TextField } from '@/components/TextField';
import { Alpha, Colors, Layout, Radius, Spacing } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';
import { aiSettingsService, DEFAULT_MODELS, type AIProvider, type AISettings } from '@/services/aiSettingsService';
import { AI_PROVIDERS } from '@core/ai';

export default function AiServicesScreen() {
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>({ provider: 'gemini', keys: {}, models: {} });
  const [viewedProvider, setViewedProvider] = useState<AIProvider>('gemini');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    aiSettingsService.load().then((settings) => {
      setAISettings(settings);
      setViewedProvider(settings.provider);
      setLoaded(true);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await aiSettingsService.save(aiSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    const key = aiSettings.keys[viewedProvider]?.trim();
    if (!key) {
      setTestResult({ ok: false, message: 'No API key entered' });
      return;
    }
    const model = aiSettings.models?.[viewedProvider]?.trim() || DEFAULT_MODELS[viewedProvider];

    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await apiClient.get<{ data: string }>('/api/ai/test-provider', {
        headers: {
          'X-AI-Provider': viewedProvider,
          'X-AI-Key': key,
          'X-AI-Model': model,
        },
      });
      setTestResult({ ok: true, message: `Connected — response: "${res.data.data}"` });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Connection failed';
      setTestResult({ ok: false, message: msg });
    } finally {
      setTestingConnection(false);
    }
  };

  if (!loaded) {
    return <LoadingScreen />;
  }

  const viewed = AI_PROVIDERS.find((p) => p.id === viewedProvider)!;

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.three }]}>
      <Text style={styles.hint}>Keys are stored securely on your device and never sent to our servers.</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.providerRow}>
        {AI_PROVIDERS.map((p) => {
          const isViewed = viewedProvider === p.id;
          const isActive = aiSettings.provider === p.id;
          return (
            <Pressable
              key={p.id}
              style={[styles.providerCard, isViewed && styles.providerCardActive]}
              onPress={() => { setViewedProvider(p.id); setTestResult(null); }}
            >
              <Text style={[styles.providerLabel, isViewed && styles.providerLabelActive]}>{p.shortLabel}</Text>
              {isActive && <View style={[styles.statusDot, styles.statusDotActive]} />}
              {!isActive && !!aiSettings.keys[p.id] && <View style={[styles.statusDot, styles.statusDotConfigured]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.section}>
        <View style={styles.providerHeader}>
          <View style={styles.providerHeaderLeft}>
            <Text style={styles.providerTitle}>{viewed.label}</Text>
            {viewed.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{viewed.badge}</Text>
              </View>
            )}
          </View>
          {aiSettings.provider !== viewedProvider ? (
            <Pressable
              style={styles.setActiveButton}
              onPress={() => { setAISettings((s) => ({ ...s, provider: viewedProvider })); setSuccess(false); }}
            >
              <Text style={styles.setActiveButtonText}>Set as active</Text>
            </Pressable>
          ) : (
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active provider</Text>
            </View>
          )}
        </View>

        <View style={styles.field}>
          <TextField
            label="API Key"
            value={aiSettings.keys[viewedProvider] ?? ''}
            onChangeText={(text) => {
              setSuccess(false);
              setAISettings((s) => ({ ...s, keys: { ...s.keys, [viewedProvider]: text } }));
            }}
            placeholder={viewed.placeholder}
            secureToggle
          />
          <Text style={styles.docsHint}>Get your key at {viewed.docsHint}</Text>
        </View>

        <TextField
          label="Model"
          value={aiSettings.models?.[viewedProvider] ?? DEFAULT_MODELS[viewedProvider]}
          onChangeText={(text) => {
            setSuccess(false);
            setAISettings((s) => ({ ...s, models: { ...s.models, [viewedProvider]: text } }));
          }}
          placeholder={DEFAULT_MODELS[viewedProvider]}
        />
      </View>

      <View style={styles.testRow}>
        <Pressable
          style={[styles.testButton, (testingConnection || !aiSettings.keys[viewedProvider]) && styles.testButtonDisabled]}
          onPress={handleTestConnection}
          disabled={testingConnection || !aiSettings.keys[viewedProvider]}
        >
          <Wifi size={15} color={Colors.textPrimary} />
          <Text style={styles.testButtonText}>{testingConnection ? 'Testing…' : 'Test Connection'}</Text>
        </Pressable>
        {testResult && (
          <Text style={[styles.testResultText, { color: testResult.ok ? Colors.emerald : Colors.red }]} numberOfLines={2}>
            {testResult.ok ? '✓' : '✗'} {testResult.message}
          </Text>
        )}
      </View>

      <InfoBanner
        icon={Info}
        text="The green dot marks your active provider used for all AI requests. A grey dot means a key is configured but not active."
      />

      {success && <Text style={styles.successText}>AI settings saved successfully.</Text>}

      <Button title="Save" onPress={handleSave} loading={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  hint: { fontSize: 12, color: Colors.textSecondary },

  providerRow: { gap: Spacing.two, paddingVertical: 2 },
  providerCard: {
    ...Layout.center, gap: 4,
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgSidebar,
  },
  providerCardActive: { borderColor: Colors.primary, backgroundColor: `${Colors.primary}${Alpha.tint}` },
  providerLabel: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  providerLabelActive: { color: Colors.primary },
  statusDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4 },
  statusDotActive: { backgroundColor: Colors.emerald },
  statusDotConfigured: { backgroundColor: Colors.zinc300 },

  section: { gap: Spacing.three },
  providerHeader: { ...Layout.rowBetween },
  providerHeaderLeft: { ...Layout.row, gap: 8 },
  providerTitle: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.sm, backgroundColor: `${Colors.primary}26` },
  badgeText: { fontSize: 9, fontWeight: '700', color: Colors.primary },
  setActiveButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary },
  setActiveButtonText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  activeBadge: { ...Layout.row, gap: 6 },
  activeBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.emerald },

  field: { gap: 6 },
  docsHint: { fontSize: 10, color: Colors.textSecondary },

  testRow: { ...Layout.rowWrap, gap: Spacing.two },
  testButton: {
    ...Layout.row, gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  testButtonDisabled: { opacity: 0.4 },
  testButtonText: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  testResultText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  successText: { fontSize: 12, fontWeight: '600', color: Colors.emerald },
});
