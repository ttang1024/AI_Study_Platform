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
				'@': path.resolve(__dirname, '.'),
			},
		},
		optimizeDeps: {
			include: ['xmindmark'],
		},
		server: {
			hmr: process.env.DISABLE_HMR !== 'true',
			proxy: {
				'/api': {
					target: env.VITE_API_PROXY_TARGET || 'http://localhost:5001',
					changeOrigin: true,
				},
			},
		},
	}
})
