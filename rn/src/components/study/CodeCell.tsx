import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Check from 'lucide-react-native/icons/check';
import Play from 'lucide-react-native/icons/play';
import X from 'lucide-react-native/icons/x';

import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

interface Props {
  initialCode?: string;
  /** Python assertions run after the learner's code. When present, the cell auto-grades. */
  tests?: string;
  prompt?: string;
  onPassed?: () => void;
}

const PYODIDE_VERSION = '0.26.4';
const RUN_TIMEOUT_MS = 15_000;

/**
 * The runner page.
 *
 * React Native has no Web Worker and no WebAssembly host, so Pyodide runs inside a hidden WebView —
 * which doubles as the isolation boundary: the interpreter cannot reach the app's JS context,
 * storage, or native modules, only postMessage.
 */
const RUNNER_HTML = `<!doctype html>
<html>
  <head><meta charset="utf-8" /></head>
  <body>
    <script src="https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js"></script>
    <script>
      let pyodidePromise = null;

      const post = (payload) => window.ReactNativeWebView.postMessage(JSON.stringify(payload));

      const getPyodide = () => {
        if (!pyodidePromise) {
          pyodidePromise = loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/',
          });
        }
        return pyodidePromise;
      };

      const handle = async (request) => {
        let stdout = '';
        let stderr = '';
        try {
          const pyodide = await getPyodide();
          pyodide.setStdout({ batched: (s) => { stdout += s + '\\n'; } });
          pyodide.setStderr({ batched: (s) => { stderr += s + '\\n'; } });

          await pyodide.runPythonAsync(request.code);

          // Tests run separately so a failing assertion reads as "checks failed" rather than as an
          // error in the learner's own code.
          let testsPassed;
          if (request.tests && request.tests.trim()) {
            try {
              await pyodide.runPythonAsync(request.tests);
              testsPassed = true;
            } catch (testError) {
              testsPassed = false;
              stderr += String(testError) + '\\n';
            }
          }

          post({ id: request.id, ok: true, stdout: stdout, stderr: stderr, testsPassed: testsPassed });
        } catch (error) {
          post({ id: request.id, ok: false, stdout: stdout, stderr: stderr + String(error) });
        }
      };

      // Android delivers to document, iOS to window; listening on both is the portable form.
      const onMessage = (event) => handle(JSON.parse(event.data));
      window.addEventListener('message', onMessage);
      document.addEventListener('message', onMessage);
    </script>
  </body>
</html>`;

interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  testsPassed?: boolean;
}

/**
 * An editable Python cell that runs on-device.
 *
 * Execution is entirely local, so nothing the learner writes reaches the server and the blast radius
 * of hostile code is a sandboxed WebView. That is also why this needs no server-side runner.
 */
export const CodeCell: React.FC<Props> = ({ initialCode = '', tests, prompt, onPassed }) => {
  const webViewRef = useRef<WebView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [code, setCode] = useState(initialCode);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const finish = (next: RunResult) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setRunning(false);
    setResult(next);
    if (next.testsPassed) onPassed?.();
  };

  const run = () => {
    setRunning(true);
    setResult(null);

    // Remounting the WebView is the only way to stop WebAssembly mid-execution — there is no
    // interrupt, so a `while True:` would otherwise spin until the user force-quits the app.
    timeoutRef.current = setTimeout(() => {
      setReloadKey((k) => k + 1);
      finish({
        ok: false,
        stdout: '',
        stderr: `Stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Check for a loop that never ends.`,
      });
    }, RUN_TIMEOUT_MS);

    webViewRef.current?.postMessage(JSON.stringify({ id: String(Date.now()), code, tests }));
  };

  const output = result ? [result.stdout, result.stderr].filter(Boolean).join('\n').trimEnd() : '';

  return (
    <View style={styles.container}>
      {!!prompt && <Text style={styles.prompt}>{prompt}</Text>}

      <TextInput
        value={code}
        onChangeText={setCode}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="# Write Python here"
        placeholderTextColor={Colors.textSecondary}
        style={styles.editor}
      />

      <View style={styles.toolbar}>
        <Pressable
          onPress={run}
          disabled={running || !code.trim()}
          style={[styles.runButton, (running || !code.trim()) && styles.disabled]}
        >
          {running ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Play size={14} color={Colors.white} />
          )}
          <Text style={styles.runText}>{running ? 'Running…' : 'Run'}</Text>
        </Pressable>

        {result?.testsPassed !== undefined && (
          <View style={styles.verdict}>
            {result.testsPassed ? (
              <Check size={14} color={Colors.emerald} />
            ) : (
              <X size={14} color={Colors.red} />
            )}
            <Text style={[styles.verdictText, { color: result.testsPassed ? Colors.emerald : Colors.red }]}>
              {result.testsPassed ? 'All checks passed' : 'Checks failed'}
            </Text>
          </View>
        )}
      </View>

      {running && !result && (
        <Text style={styles.caption}>
          Starting Python… the first run downloads the interpreter, which takes a few seconds.
        </Text>
      )}

      {!!output && (
        <Text style={[styles.output, result?.ok === false && styles.outputError]} selectable>
          {output}
        </Text>
      )}

      {/* Zero-sized but mounted: the interpreter has to stay resident between runs, or every run
          would re-download it. */}
      <WebView
        key={reloadKey}
        ref={webViewRef}
        source={{ html: RUNNER_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={(event) => {
          try {
            finish(JSON.parse(event.nativeEvent.data) as RunResult);
          } catch {
            finish({ ok: false, stdout: '', stderr: 'The Python runtime returned something unreadable.' });
          }
        }}
        style={styles.hiddenWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bgSidebar,
  },
  prompt: {
    ...Typography.body,
    color: Colors.textPrimary,
    padding: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  editor: {
    minHeight: 180,
    padding: Spacing.two,
    color: Colors.textPrimary,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
    textAlignVertical: 'top',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgApp,
  },
  runButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  disabled: { opacity: 0.5 },
  runText: { ...Typography.captionBold, color: Colors.white },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verdictText: { ...Typography.captionBold },
  caption: { ...Typography.caption, color: Colors.textSecondary, padding: Spacing.two },
  output: {
    padding: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    color: Colors.textSecondary,
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 17,
  },
  outputError: { color: Colors.red },
  hiddenWebView: { width: 0, height: 0, opacity: 0 },
});

export default CodeCell;
