import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', '')
	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				// Shared platform-agnostic package (packages/core). Listed before '@' —
				// harmless either way since '@' only matches '@/'-prefixed ids, but explicit.
				'@core': path.resolve(__dirname, '../packages/core/src'),
				'@': path.resolve(__dirname, '.'),
			},
			// Force a single instance of React and the router. Without this, Vite can
			// end up serving a lazy route chunk a second, separately-optimized copy of
			// react-router, whose <Router> context the entry chunk's hooks can't read —
			// surfacing as "useLocation() may be used only in the context of a <Router>"
			// white screens on client-side navigation to a lazy route.
			dedupe: ['react', 'react-dom', 'react-router', 'react-router-dom'],
		},
		optimizeDeps: {
			// Pre-bundle the router up front so navigating to a lazy route never triggers
			// a mid-session re-optimization that splits it into a second module instance.
			include: ['xmindmark', 'mdast-util-to-string', 'react-router', 'react-router-dom'],
		},
		build: {
			// React/router load eagerly on every page; isolating them into their own chunk keeps the
			// framework (which changes rarely) cached across deploys, separate from the app code that
			// changes on every release. The markdown/KaTeX stack is deliberately NOT grouped here:
			// it's reached transitively from the eager shell, so naming it forces the whole ~700KB
			// stack into the initial modulepreload. Leaving it to Vite keeps it in lazy route chunks.
			// jspdf/html2canvas/jszip are dynamically imported, so Vite already emits them on demand.
			chunkSizeWarningLimit: 800,
			rollupOptions: {
				output: {
					manualChunks(id) {
						if (!id.includes('node_modules')) return undefined
						if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id))
							return 'react-vendor'
						return undefined
					},
				},
			},
		},
		server: {
			hmr: process.env.DISABLE_HMR !== 'true',
			proxy: {
				'/api': {
					target: env.VITE_API_PROXY_TARGET || 'http://localhost:5001',
					changeOrigin: true,
				},
				'/hubs': {
					target: env.VITE_API_PROXY_TARGET || 'http://localhost:5001',
					changeOrigin: true,
					ws: true,
				},
			},
		},
	}
})
