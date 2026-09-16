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
