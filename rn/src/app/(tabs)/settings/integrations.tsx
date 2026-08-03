import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import Plug from 'lucide-react-native/icons/plug';
import Terminal from 'lucide-react-native/icons/terminal';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { Colors, Layout, Radius, Spacing, Typography } from '@/constants/theme';
import {
  API_SCOPE_LABELS,
  WEBHOOK_EVENT_LABELS,
  integrationsService,
  type ApiKey,
  type Webhook,
} from '@/services/integrationsService';
import { getApiErrorMessage } from '@/utils/apiError';

/** Shown once, in place, right after creation — the only moment the value exists on the device. */
function SecretReveal({ label, value, onDismiss }: { label: string; value: string; onDismiss: () => void }) {
  return (
    <Card style={styles.warnCard}>
      <View style={styles.row}>
        <TriangleAlert size={18} color={Colors.amber} />
        <Text style={styles.warnTitle}>{label}</Text>
      </View>
      <Text style={styles.warnBody}>Copy it now — it can&apos;t be shown again.</Text>
      <Text selectable style={styles.secret}>{value}</Text>
      <Button title="Copy" variant="secondary" onPress={() => Clipboard.setStringAsync(value)} />
      <Button title="I've saved it" variant="secondary" onPress={onDismiss} />
    </Card>
  );
}

function Checkbox({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable onPress={onToggle} style={styles.checkRow} hitSlop={6}>
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
        {checked && <Check size={12} color={Colors.white} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

export default function IntegrationsScreen() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState<string[]>(['library:read']);
  const [newKey, setNewKey] = useState<string | null>(null);

  const [hookUrl, setHookUrl] = useState('');
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [k, w] = await Promise.all([
        integrationsService.getApiKeys(),
        integrationsService.getWebhooks(),
      ]);
      setKeys(k.data.data);
      setWebhooks(w.data.data);
    } catch {
      setKeys([]); setWebhooks([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const toggle = (list: string[], value: string, set: (next: string[]) => void) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true); setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  if (keys === null) {
    return (
      <View style={Layout.fillCenter}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.row}>
        <Terminal size={22} color={Colors.primary} />
        <Text style={styles.title}>API keys</Text>
      </View>
      <Text style={styles.subtitle}>
        For scripts and integrations. Send as X-Api-Key or a bearer token.
      </Text>

      {newKey && (
        <SecretReveal label="Your new API key" value={newKey} onDismiss={() => setNewKey(null)} />
      )}

      <Card style={styles.card}>
        <TextField label="Name" value={keyName} onChangeText={setKeyName} placeholder="My sync script" />
        <Text style={styles.legend}>What it may do</Text>
        {Object.entries(API_SCOPE_LABELS).map(([scope, label]) => (
          <Checkbox
            key={scope}
            label={label}
            checked={keyScopes.includes(scope)}
            onToggle={() => toggle(keyScopes, scope, setKeyScopes)}
          />
        ))}
        <Button
          title="Create key"
          loading={busy}
          disabled={!keyName.trim() || keyScopes.length === 0}
          onPress={() =>
            run(async () => {
              const res = await integrationsService.createApiKey({ name: keyName, scopes: keyScopes });
              setNewKey(res.data.data.plaintextKey);
              setKeyName('');
            }, 'Could not create the key.')
          }
        />
      </Card>

      {keys.map((key) => (
        <Card key={key.apiKeyId} style={styles.card}>
          <Text style={styles.cardTitle}>
            {key.name}
            {key.revokedAt ? ' · revoked' : ''}
          </Text>
          <Text style={styles.meta}>
            {key.prefix}… · {key.scopes.join(', ')} ·{' '}
            {key.lastUsedAt ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : 'never used'}
          </Text>
          {!key.revokedAt && (
            <Button
              title="Revoke"
              variant="danger"
              loading={busy}
              onPress={() =>
                run(async () => {
                  await integrationsService.revokeApiKey(key.apiKeyId);
                }, 'Could not revoke the key.')
              }
            />
          )}
        </Card>
      ))}

      <View style={[styles.row, styles.sectionGap]}>
        <Plug size={22} color={Colors.primary} />
        <Text style={styles.title}>Webhooks</Text>
      </View>
      <Text style={styles.subtitle}>
        We POST to your HTTPS endpoint when things happen. Each delivery is signed so you can verify
        it came from us.
      </Text>

      {newSecret && (
        <SecretReveal
          label="Your webhook signing secret"
          value={newSecret}
          onDismiss={() => setNewSecret(null)}
        />
      )}

      <Card style={styles.card}>
        <TextField
          label="Endpoint URL"
          value={hookUrl}
          onChangeText={setHookUrl}
          placeholder="https://example.com/hooks/study"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={styles.legend}>Send me an event when…</Text>
        {Object.entries(WEBHOOK_EVENT_LABELS).map(([event, label]) => (
          <Checkbox
            key={event}
            label={label}
            checked={hookEvents.includes(event)}
            onToggle={() => toggle(hookEvents, event, setHookEvents)}
          />
        ))}
        <Button
          title="Add webhook"
          loading={busy}
          disabled={!hookUrl.trim() || hookEvents.length === 0}
          onPress={() =>
            run(async () => {
              const res = await integrationsService.createWebhook({ url: hookUrl, events: hookEvents });
              setNewSecret(res.data.data.secret);
              setHookUrl(''); setHookEvents([]);
            }, 'Could not add the webhook.')
          }
        />
      </Card>

      {webhooks.map((hook) => (
        <Card key={hook.webhookId} style={styles.card}>
          <Text style={styles.cardTitle} numberOfLines={1}>{hook.url}</Text>
          <Text style={styles.meta}>
            {hook.events.join(', ')}
            {hook.isActive ? '' : ' · disabled after repeated failures'}
          </Text>
          <Button
            title="Remove"
            variant="danger"
            loading={busy}
            onPress={() =>
              run(async () => {
                await integrationsService.deleteWebhook(hook.webhookId);
              }, 'Could not remove the webhook.')
            }
          />
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgApp },
  content: { padding: Spacing.three, gap: Spacing.two, paddingBottom: Spacing.five },
  row: { ...Layout.row, gap: Spacing.two },
  sectionGap: { marginTop: Spacing.four },
  title: { ...Typography.heading, color: Colors.textPrimary },
  subtitle: { ...Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.two },
  card: { gap: Spacing.two },
  cardTitle: { ...Typography.bodyBold, color: Colors.textPrimary },
  meta: { ...Typography.caption, color: Colors.textSecondary },
  legend: { ...Typography.captionBold, color: Colors.textPrimary, marginTop: Spacing.two },
  checkRow: { ...Layout.row, gap: Spacing.two },
  checkBox: {
    width: 20,
    height: 20,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Layout.center,
  },
  checkBoxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  checkLabel: { ...Typography.caption, color: Colors.textSecondary, flexShrink: 1 },
  warnCard: { gap: Spacing.two, borderColor: Colors.amber, borderWidth: 1 },
  warnTitle: { ...Typography.subheading, color: Colors.textPrimary },
  warnBody: { ...Typography.caption, color: Colors.textSecondary },
  secret: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: Colors.textPrimary,
    backgroundColor: Colors.bgApp,
    padding: Spacing.two,
    borderRadius: Radius.sm,
  },
  error: { ...Typography.caption, color: Colors.errorText },
});
