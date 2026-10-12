import type { Plugin } from 'vite'

/**
 * Injects a Content-Security-Policy <meta> into the built index.html.
 *
 * The policy exists for script-src: the app renders content other people wrote (shared documents, group
 * chat, notes, clipped articles) and keeps the user's AI provider keys in localStorage, so a sanitizer
 * slip must not become script execution. Everything else is deliberately broad — thumbnails, podcast
 * audio, presigned media URLs and the nine embeddable video sites come from hosts we can't enumerate,
 * and loading an image or framing a player can't run script in this origin.
 *
 * Build-only: Vite's dev server serves an inline react-refresh preamble that this policy would block.
 * frame-ancestors can't be set from a <meta>; it has to come from a response header if it's wanted.
 */
export function cspPlugin(options: { apiUrl?: string } = {}): Plugin {
	const apiOrigin = toOrigin(options.apiUrl)

	const directives: Record<string, string[]> = {
		'default-src': ["'self'"],
		// accounts.google.com serves the Google One Tap client (useGoogleOneTap.ts).
		'script-src': ["'self'", 'https://accounts.google.com/gsi/client'],
		// 'unsafe-inline' for styles: KaTeX, markmap and tiptap inject <style> elements at runtime.
		'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com/gsi/style'],
		'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
		'img-src': ["'self'", 'data:', 'blob:', 'https:'],
		'media-src': ["'self'", 'data:', 'blob:', 'https:'],
		'connect-src': ["'self'", 'https:', 'wss:', ...(apiOrigin ? [apiOrigin, apiOrigin.replace(/^http/, 'ws')] : [])],
		'frame-src': ["'self'", 'blob:', 'data:', 'https:'],
		'worker-src': ["'self'", 'blob:'],
		'manifest-src': ["'self'"],
		'object-src': ["'none'"],
		'base-uri': ["'self'"],
		'form-action': ["'self'", 'https://accounts.google.com'],
	}

	const policy = Object.entries(directives)
		.map(([name, values]) => `${name} ${[...new Set(values)].join(' ')}`)
		.join('; ')

	return {
		name: 'study-csp',
		apply: 'build',
		transformIndexHtml: {
			order: 'post',
			handler: () => [
				{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: policy }, injectTo: 'head-prepend' },
			],
		},
	}
}

function toOrigin(url: string | undefined): string | undefined {
	if (!url) return undefined
	try {
		return new URL(url).origin
	} catch {
		return undefined
	}
}
