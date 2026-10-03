import { describe, expect, it } from 'vitest'
import { seoPlugin } from '../vite-plugin-seo'

const ORIGIN = 'https://toto-study.com'

/** Runs the plugin's generateBundle hook and returns the files it emitted, keyed by name. */
const emit = (options: Parameters<typeof seoPlugin>[0]): Record<string, string> => {
	const files: Record<string, string> = {}
	const context = {
		emitFile: ({ fileName, source }: { fileName: string; source: string }) => {
			files[fileName] = source
		},
		warn: () => {},
	}
	// Rollup types the hook against the full PluginContext; the plugin only touches these two.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(seoPlugin(options).generateBundle as any).call(context, {}, {}, false)
	return files
}

/** Runs transformIndexHtml over a shell. Returns the hook's raw {html, tags} result. */
const transform = (options: Parameters<typeof seoPlugin>[0], html: string) => {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const hook = seoPlugin(options).transformIndexHtml as any
	return hook.handler(html, {} as any)
}

/** transformIndexHtml's rewritten HTML, whichever shape the hook returned it in. */
const transformHtml = (options: Parameters<typeof seoPlugin>[0], html: string): string => {
	const result = transform(options, html)
	return typeof result === 'string' ? result : result.html
}

const locsOf = (sitemap: string): string[] =>
	[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1])

/** Every Disallow path in the file, flattened across groups. */
const disallowsOf = (robots: string): string[] =>
	robots
		.split('\n')
		.filter((line) => line.startsWith('Disallow: '))
		.map((line) => line.slice('Disallow: '.length))

/**
 * The Disallow lines of the group naming `agent`, which is the only group that agent obeys. A
 * group can name several agents, so every User-agent line in the block counts.
 */
const groupFor = (robots: string, agent: string): string[] => {
	const groups = robots.split(/\n\s*\n/).map((block) => block.split('\n').map((line) => line.trim()))
	const group = groups.find((lines) => lines.includes(`User-agent: ${agent}`))
	return (group ?? []).filter((line) => line.startsWith('Disallow:'))
}

describe('robots.txt', () => {
	it('keeps search engines off the authenticated app and off share links', () => {
		const everyone = groupFor(emit({ origin: ORIGIN })['robots.txt'], '*')
		expect(everyone).toContain('Disallow: /share/')
		expect(everyone).toContain('Disallow: /library')
	})

	it('lets link-preview crawlers read /share/ so pasted links unfurl', () => {
		const robots = emit({ origin: ORIGIN })['robots.txt']
		for (const agent of ['Twitterbot', 'facebookexternalhit', 'LinkedInBot', 'Slackbot', 'Discordbot']) {
			const group = groupFor(robots, agent)
			expect(group.length).toBeGreaterThan(0)
			expect(group).not.toContain('Disallow: /share/')
			// The rest of the private app stays off limits to them too.
			expect(group).toContain('Disallow: /library')
		}
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

	it('points at the sitemap when an origin is configured, and omits the line otherwise', () => {
		expect(emit({ origin: ORIGIN })['robots.txt']).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`)
		expect(emit({})['robots.txt']).not.toContain('Sitemap:')
	})
})

describe('sitemap.xml', () => {
	it('lists the homepage first, with absolute URLs on the configured origin', () => {
		const locs = locsOf(emit({ origin: ORIGIN })['sitemap.xml'])

		expect(locs[0]).toBe(`${ORIGIN}/`)
		expect(locs.every((loc) => loc.startsWith(`${ORIGIN}/`))).toBe(true)
	})

	it('lists only the publicly crawlable routes', () => {
		expect(emit({ origin: ORIGIN })['sitemap.xml']).not.toContain('/share/')
	})

	it('does not double the slash when the origin has a trailing one', () => {
		const locs = locsOf(emit({ origin: `${ORIGIN}/` })['sitemap.xml'])

		expect(locs).toContain(`${ORIGIN}/`)
		expect(locs.some((loc) => loc.includes('//', 'https://'.length))).toBe(false)
	})

	it('is skipped without an origin, since it needs absolute URLs', () => {
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

const SHELL = `<!doctype html>
<html>
	<head>
		<link rel="canonical" href="%VITE_SHARE_BASE_URL%/" />
		<meta
			property="og:image"
			content="%VITE_SHARE_BASE_URL%/share.png" />
		<meta property="og:url" content="%VITE_SHARE_BASE_URL%/" />
		<meta name="theme-color" content="#0d9488" />
		<script type="application/ld+json">{ "url": "%VITE_SHARE_BASE_URL%/" }</script>
	</head>
	<body>
		<img data-social-thumbnail src="%VITE_SHARE_BASE_URL%/share.png" />
	</body>
</html>`

describe('absolute social URLs', () => {
	it('resolves every origin placeholder when an origin is given', () => {
		const html = transformHtml({ origin: ORIGIN }, SHELL)

		expect(html).not.toContain('%VITE_SHARE_BASE_URL%')
		expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/" />`)
		expect(html).toContain(`content="${ORIGIN}/share.png"`)
		expect(html).toContain(`href="${ORIGIN}/"`)
	})

	it('never ships a placeholder or a relative og:image when the origin is missing', () => {
		const html = transformHtml({}, SHELL)

		// A crawler reads og:image off-site, so a relative path is no better than the placeholder.
		expect(html).not.toContain('%VITE_SHARE_BASE_URL%')
		expect(html).not.toContain('og:image')
		expect(html).not.toContain('og:url')
		expect(html).not.toContain('rel="canonical"')
	})

	it('leaves the rest of the shell alone when the origin is missing', () => {
		const html = transformHtml({}, SHELL)

		expect(html).toContain('<meta name="theme-color" content="#0d9488" />')
		// An <img> src and the ld+json url resolve fine against the page the crawler already has.
		expect(html).toContain('<img data-social-thumbnail src="/share.png" />')
		expect(html).toContain('"url": "/"')
	})
})

describe('Search Console verification', () => {
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

	it('keeps the Search Console tag independent of the origin', () => {
		const result = transform({ origin: '', googleSiteVerification: 'tok123' }, SHELL)

		expect(result.tags).toHaveLength(1)
		expect(result.tags[0].attrs.content).toBe('tok123')
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
