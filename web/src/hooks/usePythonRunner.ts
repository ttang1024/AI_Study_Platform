import { useCallback, useEffect, useRef, useState } from 'react';

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  testsPassed?: boolean;
  /** True when the run was killed for exceeding the time limit. */
  timedOut?: boolean;
}

/**
 * Wall-clock limit for one run. Generous enough for a teaching exercise, short enough that a
 * runaway loop is obviously dealt with rather than appearing to hang.
 */
const RUN_TIMEOUT_MS = 15_000;

/**
 * Runs Python in a worker, with the ability to kill it.
 *
 * The timeout is the reason this is a hook rather than a promise wrapper: enforcing it means
 * terminating the worker, which destroys the loaded interpreter, so the next run has to start a
 * fresh one. Callers get told the run timed out rather than silently receiving nothing.
 */
export function usePythonRunner() {
  const workerRef = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);

  const disposeWorker = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setReady(false);
  }, []);

  useEffect(() => disposeWorker, [disposeWorker]);

  const run = useCallback(
    (code: string, tests?: string): Promise<RunResult> => {
      setRunning(true);

      return new Promise<RunResult>((resolve) => {
        // Created lazily and reused: the first run pays for downloading and starting the
        // interpreter, later ones do not.
        if (!workerRef.current) {
          workerRef.current = new Worker(new URL('../workers/pythonRunner.worker.ts', import.meta.url), {
            type: 'module',
          });
        }

        const worker = workerRef.current;
        const id = crypto.randomUUID();

        const finish = (result: RunResult) => {
          clearTimeout(timer);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
          setRunning(false);
          resolve(result);
        };

        const timer = setTimeout(() => {
          // The only way to stop WebAssembly mid-execution.
          disposeWorker();
          finish({
            ok: false,
            stdout: '',
            stderr: `Stopped after ${RUN_TIMEOUT_MS / 1000} seconds. Check for a loop that never ends.`,
            timedOut: true,
          });
        }, RUN_TIMEOUT_MS);

        const onMessage = (event: MessageEvent<RunResult & { id: string }>) => {
          if (event.data.id !== id) return;
          setReady(true);
          finish(event.data);
        };

        const onError = (event: ErrorEvent) => {
          finish({ ok: false, stdout: '', stderr: event.message || 'The Python runtime failed to start.' });
        };

        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage({ id, code, tests });
      });
    },
    [disposeWorker],
  );

  return { run, running, ready };
}
