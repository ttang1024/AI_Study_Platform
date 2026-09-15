import { pdfjs } from 'react-pdf';
// Vite's ?url suffix emits the worker as a hashed asset in dist/ and hands back its path, so
// it is served from our own origin alongside everything else.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Points pdf.js at a locally bundled worker.
 *
 * This used to be `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`, repeated in
 * each of the three viewers, which put every PDF in the app behind a third-party CDN: unpkg down,
 * blocked on a corporate network, or slow, and the viewer never finishes loading. The protocol-
 * relative URL also inherited the page's scheme, and fetching a script from someone else's origin
 * at runtime is a supply-chain surface we do not need — the file is already in node_modules.
 *
 * pdf.js refuses to run a worker whose version does not match the API's, so `pdfjs-dist` is pinned
 * in package.json to the exact version react-pdf depends on. Those two move together.
 *
 * Imported for its side effect, before any <Document> renders.
 */
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
