import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'

// Absolute path to packages/core/src without needing Node types (@types/node
// isn't a dependency here, and the tsconfig restricts `types`).
const coreSrc = new URL('../packages/core/src', import.meta.url).pathname

// CRXJS gives MV3 extensions HMR — including content scripts — so editing the
// React panel hot-updates the injected UI on a YouTube tab without a manual
// "reload extension". React Fast Refresh is provided by @vitejs/plugin-react.
export default defineConfig({
	plugins: [react(), crx({ manifest })],
	resolve: {
		// Shared platform-agnostic package (packages/core).
		alias: {
			'@core': coreSrc,
		},
	},
	server: {
		port: 5173,
		strictPort: true,
		hmr: { port: 5173 },
	},
	// Lets the content-script HMR websocket connect from the youtube.com origin.
	legacy: { skipWebSocketTokenCheck: true },
})
