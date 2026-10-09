import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DISALLOWED_PREFIXES, renderFeaturePageHtml } from '../../../vite-plugin-seo'
import { FEATURE_PAGE_SLUGS } from '../featurePageSlugs'
import { FEATURE_PAGES, featurePagePath } from '../featurePages'

const ORIGIN = 'https://toto-study.com'
const indexHtml = readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8').split(
	'%VITE_SHARE_BASE_URL%',
).join(ORIGIN)

describe('feature pages', () => {
	it('has content for exactly the slugs App.tsx routes', () => {
		expect(FEATURE_PAGES.map((p) => p.slug).sort()).toEqual([...FEATURE_PAGE_SLUGS].sort())
	})

	it.each(FEATURE_PAGES.map((p) => [p.slug]))('%s is not blocked by robots.txt', (slug) => {
		const pagePath = featurePagePath(slug)
		expect(DISALLOWED_PREFIXES.filter((prefix) => pagePath.startsWith(prefix))).toEqual([])
	})

	it.each(FEATURE_PAGES.map((p) => [p.slug, p]))('%s has search-result sized title and description', (_, page) => {
		expect(page.title.length).toBeLessThanOrEqual(65)
		expect(page.description.length).toBeGreaterThanOrEqual(110)
		expect(page.description.length).toBeLessThanOrEqual(165)
	})

	it('gives every page a unique title and description', () => {
		expect(new Set(FEATURE_PAGES.map((p) => p.title)).size).toBe(FEATURE_PAGES.length)
		expect(new Set(FEATURE_PAGES.map((p) => p.description)).size).toBe(FEATURE_PAGES.length)
	})
})

describe('renderFeaturePageHtml', () => {
	const page = FEATURE_PAGES[0]
	const html = renderFeaturePageHtml(indexHtml, page, ORIGIN)
	const url = `${ORIGIN}${featurePagePath(page.slug)}`
	const doc = new DOMParser().parseFromString(html, 'text/html')
	const meta = (key: string) =>
		doc.querySelector<HTMLMetaElement>(`meta[name="${key}"], meta[property="${key}"]`)?.content

	it('replaces the head with the page own title, description and canonical', () => {
		expect(doc.title).toBe(page.title)
		expect(meta('description')).toBe(page.description)
		expect(meta('og:title')).toBe(page.title)
		expect(meta('twitter:description')).toBe(page.description)
		expect(meta('og:url')).toBe(url)
		expect(doc.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href')).toBe(url)
	})

	it('swaps the homepage JSON-LD for the page own, valid graph', () => {
		const blocks = doc.querySelectorAll('script[type="application/ld+json"]')
		expect(blocks).toHaveLength(1)
		const graph = JSON.parse(blocks[0].textContent ?? '')['@graph']
		expect(graph.map((n: { '@type': string }) => n['@type'])).toEqual(['WebPage', 'BreadcrumbList', 'FAQPage'])
		expect(graph[2].mainEntity).toHaveLength(page.faqs.length)
	})

	it('replaces the landing copy in <noscript> and keeps the app entry script', () => {
		expect(html.match(/<noscript>/g)).toHaveLength(1)
		expect(html).toContain(`<h1>${page.h1}</h1>`)
		expect(html).not.toContain('Your complete study suite')
		expect(html).toContain('src="/src/main.tsx"')
	})

	it('lists a page own real examples in <noscript>, linked to their shares', () => {
		const withExamples = FEATURE_PAGES.find((p) => p.examples?.length)!
		const noscript = renderFeaturePageHtml(indexHtml, withExamples, ORIGIN).match(/<noscript>[\s\S]*?<\/noscript>/)![0]
		for (const ex of withExamples.examples!) {
			expect(noscript).toContain(`<a href="${ex.sharePath}">`)
			expect(noscript).toContain(ex.excerpt)
		}
		expect(html).not.toContain('<h2>Real examples</h2>')
	})

	it('fails loudly instead of shipping a page that still looks like the homepage', () => {
		expect(() => renderFeaturePageHtml(indexHtml.replace(/<noscript>[\s\S]*?<\/noscript>/, ''), page, ORIGIN)).toThrow(
			/noscript/,
		)
	})
})
