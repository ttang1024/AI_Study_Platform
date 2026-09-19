import { describe, expect, it } from 'vitest'
import { seoPlugin } from '../vite-plugin-seo'

/** Runs the plugin's generateBundle hook and returns the files it emitted. */
const emit = (origin: string): Record<string, string> => {
	const files: Record<string, string> = {}
	const plugin = seoPlugin({ origin })
	const context = {
		emitFile: ({ fileName, source }: { fileName: string; source: string }) => {
			files[fileName] = source
		},
		warn: () => {},
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	;(plugin.generateBundle as any).call(context, {}, {}, false)
	return files
}

/** Runs the plugin's transformIndexHtml hook over a shell and returns the rewritten HTML. */
const transform = (origin: string, html: string): string => {
	const plugin = seoPlugin({ origin })
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const result = (plugin.transformIndexHtml as any).handler(html, {} as any)
	return typeof result === 'string' ? result : result.html
}

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
	const robots = emit('https://toto-study.com')['robots.txt']

	it('keeps search engines off the authenticated app and off share links', () => {
		const everyone = groupFor(robots, '*')
		expect(everyone).toContain('Disallow: /share/')
		expect(everyone).toContain('Disallow: /library')
	})

	it('lets link-preview crawlers read /share/ so pasted links unfurl', () => {
		for (const agent of ['Twitterbot', 'facebookexternalhit', 'LinkedInBot', 'Slackbot', 'Discordbot']) {
			const group = groupFor(robots, agent)
			expect(group.length).toBeGreaterThan(0)
			expect(group).not.toContain('Disallow: /share/')
			// The rest of the private app stays off limits to them too.
			expect(group).toContain('Disallow: /library')
		}
	})

	it('points at the sitemap', () => {
		expect(robots).toContain('Sitemap: https://toto-study.com/sitemap.xml')
	})
})

describe('sitemap.xml', () => {
	it('lists only the publicly crawlable routes', () => {
		const sitemap = emit('https://toto-study.com')['sitemap.xml']
		expect(sitemap).toContain('<loc>https://toto-study.com/</loc>')
		expect(sitemap).not.toContain('/share/')
	})

	it('is skipped without an origin, since it needs absolute URLs', () => {
		expect(emit('')['sitemap.xml']).toBeUndefined()
	})
})

describe('absolute social URLs', () => {
	it('resolves every origin placeholder when an origin is given', () => {
		const html = transform('https://toto-study.com', SHELL)

		expect(html).not.toContain('%VITE_SHARE_BASE_URL%')
		expect(html).toContain('<meta property="og:url" content="https://toto-study.com/" />')
		expect(html).toContain('content="https://toto-study.com/share.png"')
		expect(html).toContain('href="https://toto-study.com/"')
	})

	it('never ships a placeholder or a relative og:image when the origin is missing', () => {
		const html = transform('', SHELL)

		// A crawler reads og:image off-site, so a relative path is no better than the placeholder.
		expect(html).not.toContain('%VITE_SHARE_BASE_URL%')
		expect(html).not.toContain('og:image')
		expect(html).not.toContain('og:url')
		expect(html).not.toContain('rel="canonical"')
	})

	it('leaves the rest of the shell alone when the origin is missing', () => {
		const html = transform('', SHELL)

		expect(html).toContain('<meta name="theme-color" content="#0d9488" />')
		// An <img> src and the ld+json url resolve fine against the page the crawler already has.
		expect(html).toContain('<img data-social-thumbnail src="/share.png" />')
		expect(html).toContain('"url": "/"')
	})

	it('keeps the Search Console tag independent of the origin', () => {
		const plugin = seoPlugin({ origin: '', googleSiteVerification: 'tok123' })
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const result = (plugin.transformIndexHtml as any).handler(SHELL, {} as any)

		expect(result.tags).toHaveLength(1)
		expect(result.tags[0].attrs.content).toBe('tok123')
	})
})
