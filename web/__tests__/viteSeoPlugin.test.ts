import { describe, expect, it } from 'vitest'
import { seoPlugin } from '../vite-plugin-seo'

const ORIGIN = 'https://example.test'

/** Runs the plugin's generateBundle hook and returns the emitted files keyed by name. */
const emit = (options: Parameters<typeof seoPlugin>[0]): Record<string, string> => {
	const files: Record<string, string> = {}
	const ctx = {
		emitFile: (file: { fileName: string; source: string }) => {
			files[file.fileName] = file.source
		},
		warn: () => {},
	}
	// Rollup types the hook against the full PluginContext; the plugin only touches these two.
	;(seoPlugin(options).generateBundle as any).call(ctx)
	return files
}

const transform = (options: Parameters<typeof seoPlugin>[0], html: string) => {
	const hook = seoPlugin(options).transformIndexHtml as any
	return hook.handler(html)
}

const locsOf = (sitemap: string): string[] =>
	[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

const disallowsOf = (robots: string): string[] =>
	robots
		.split('\n')
		.filter((line) => line.startsWith('Disallow: '))
		.map((line) => line.slice('Disallow: '.length))

describe('seoPlugin sitemap.xml', () => {
	it('lists the homepage first, with absolute URLs on the configured origin', () => {
		const locs = locsOf(emit({ origin: ORIGIN })['sitemap.xml'])

		expect(locs[0]).toBe(`${ORIGIN}/`)
		expect(locs.every((loc) => loc.startsWith(`${ORIGIN}/`))).toBe(true)
	})

	it('does not double the slash when the origin has a trailing one', () => {
		const locs = locsOf(emit({ origin: `${ORIGIN}/` })['sitemap.xml'])

		expect(locs).toContain(`${ORIGIN}/`)
		expect(locs.some((loc) => loc.includes('//', 'https://'.length))).toBe(false)
	})

	it('is skipped when no origin is configured, since it needs absolute URLs', () => {
		const files = emit({})

		expect(files['sitemap.xml']).toBeUndefined()
		expect(files['robots.txt']).toBeDefined()
	})

	/**
	 * The guard that matters as routes churn: submitting a URL that robots.txt blocks is the
	 * "Indexed, though blocked by robots.txt" warning in Search Console. Adding a route to
	 * SITEMAP_ROUTES without removing its Disallow prefix should fail here, not in production.
	 */
	it('never lists a URL that robots.txt disallows', () => {
		const files = emit({ origin: ORIGIN })
		const disallowed = disallowsOf(files['robots.txt'])

		for (const loc of locsOf(files['sitemap.xml'])) {
			const path = loc.slice(ORIGIN.length)
			const blockedBy = disallowed.find((prefix) => path.startsWith(prefix))
			expect(blockedBy, `${path} is in the sitemap but blocked by "Disallow: ${blockedBy}"`).toBeUndefined()
		}
	})
})

describe('seoPlugin robots.txt', () => {
	it('points at the sitemap when an origin is configured, and omits the line otherwise', () => {
		expect(emit({ origin: ORIGIN })['robots.txt']).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
		expect(emit({})['robots.txt']).not.toContain('Sitemap:')
	})

	it('keeps token-bearing and authenticated paths out of the index', () => {
		const disallowed = disallowsOf(emit({ origin: ORIGIN })['robots.txt'])

		// /share/ carries "anyone with the link" user content — link-shared is not index-shared.
		expect(disallowed).toContain('/share/')
		expect(disallowed).toContain('/auth/')
		expect(disallowed).toContain('/verify-email')
		expect(disallowed).toContain('/dashboard')
		expect(disallowed).toContain('/settings')
	})
})

describe('seoPlugin Search Console verification', () => {
	it('injects the meta tag when a token is configured', () => {
		const result = transform({ googleSiteVerification: 'token-123' }, '<html></html>')

		expect(result.tags).toEqual([
			{
				tag: 'meta',
				attrs: { name: 'google-site-verification', content: 'token-123' },
				injectTo: 'head',
			},
		])
	})

	it('trims whitespace, so a token pasted with a stray newline still verifies', () => {
		const result = transform({ googleSiteVerification: '  token-123\n' }, '<html></html>')

		expect(result.tags[0].attrs.content).toBe('token-123')
	})

	it('injects no tag when no token is configured', () => {
		// The handler still returns {html, tags} either way — it also resolves the origin
		// placeholders — so the absence of a token shows up as an empty tag list, not as a
		// bare string.
		expect(transform({}, '<html></html>')).toEqual({ html: '<html></html>', tags: [] })
		expect(transform({ googleSiteVerification: '   ' }, '<html></html>')).toEqual({
			html: '<html></html>',
			tags: [],
		})
	})
})
