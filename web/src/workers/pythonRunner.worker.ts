/// <reference lib="webworker" />

/**
 * Runs learner-written Python in Pyodide (CPython compiled to WebAssembly).
 *
 * In a worker for one reason above all: student code contains infinite loops. WebAssembly has no
 * pre-emption, so a `while True:` on the main thread locks the tab with no way back — the only
 * remedy is `worker.terminate()`, which needs the code to be off the main thread in the first place.
 *
 * Pyodide is fetched from a CDN rather than bundled: it is tens of megabytes, and only the small
 * minority of learners doing programming courses will ever load it.
 */

const PYODIDE_VERSION = '0.26.4';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

interface RunRequest {
  id: string;
  code: string;
  /** Optional assertions appended after the learner's code, used for auto-grading. */
  tests?: string;
}

interface RunResponse {
  id: string;
  ok: boolean;
  stdout: string;
  stderr: string;
  /** Present only when tests were supplied. */
  testsPassed?: boolean;
}

declare const loadPyodide: (options: { indexURL: string }) => Promise<PyodideApi>;

interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(options: { batched: (s: string) => void }): void;
  setStderr(options: { batched: (s: string) => void }): void;
}

let pyodidePromise: Promise<PyodideApi> | null = null;

const getPyodide = (): Promise<PyodideApi> => {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      // importScripts is synchronous and defines the global `loadPyodide`.
      (self as unknown as { importScripts: (url: string) => void }).importScripts(
        `${PYODIDE_BASE}pyodide.js`,
      );
      return loadPyodide({ indexURL: PYODIDE_BASE });
    })();
  }
  return pyodidePromise;
};

self.onmessage = async (event: MessageEvent<RunRequest>) => {
  const { id, code, tests } = event.data;

  let stdout = '';
  let stderr = '';

  try {
    const pyodide = await getPyodide();

    pyodide.setStdout({ batched: (s) => (stdout += s + '\n') });
    pyodide.setStderr({ batched: (s) => (stderr += s + '\n') });

    await pyodide.runPythonAsync(code);

    // Tests run as a separate execution so their output is attributable, and so a failing
    // assertion is reported as "tests failed" rather than as an error in the learner's own code.
    let testsPassed: boolean | undefined;
    if (tests && tests.trim()) {
      try {
        await pyodide.runPythonAsync(tests);
        testsPassed = true;
      } catch (testError) {
        testsPassed = false;
        stderr += `${String(testError)}\n`;
      }
    }

    const response: RunResponse = { id, ok: true, stdout, stderr, testsPassed };
    self.postMessage(response);
  } catch (error) {
    const response: RunResponse = {
      id,
      ok: false,
      stdout,
      stderr: stderr + String(error),
    };
    self.postMessage(response);
  }
};

export {};
