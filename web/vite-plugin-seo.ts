import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { HtmlTagDescriptor, Plugin } from 'vite'
import { FEATURE_PAGES, featurePagePath, type FeaturePageContent } from './src/seo/featurePages'

/**
 * Build-time SEO artifacts for the web SPA: robots.txt, sitemap.xml, the optional Google Search
 * Console verification tag, and a static HTML shell per public feature page
 * (src/seo/featurePages.ts) carrying that page's own title, meta, canonical, JSON-LD and copy.
 *
 * These used to be written by `deploy.sh` after `npm run build`. They live here instead so
 * the route lists sit next to the router that defines them (web/src/App.tsx) and so a plain
 * `npm run build` produces the same output a deploy does.
 */

type SitemapRoute = {
	path: string
	changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
	/** Relative weight within this site only — it does not affect ranking against other sites. */
	priority: string
}

/**
 * Routes a crawler can fetch and get real content from. Deliberately short: almost every route
 * in App.tsx sits behind <ProtectedRoute>, which renders a redirect to /login for a logged-out
 * visitor. Listing those would submit a pile of URLs that all resolve to the same shell — the
 * pattern Search Console reports as "Duplicate without user-selected canonical" / soft 404.
 */
const SITEMAP_ROUTES: SitemapRoute[] = [
	{ path: '/', changefreq: 'weekly', priority: '1.0' },
	// Public and server-rendered as static HTML, so these are real content, not the login shell.
	...FEATURE_PAGES.map(({ slug }) => ({
		path: featurePagePath(slug),
		changefreq: 'monthly' as const,
		priority: '0.8',
	})),
	{ path: '/register', changefreq: 'monthly', priority: '0.5' },
	{ path: '/login', changefreq: 'monthly', priority: '0.3' },
]

/**
 * Paths not worth crawling, as robots.txt prefixes.
 *
 * Two different reasons, both intentional:
 *  - the authenticated app shell — crawling it yields duplicate login-redirect pages, not content;
 *  - /share/ — public-by-token links to user content. "Anyone with the link" is not the same as
 *    "indexed on Google", and a user sharing a doc with a classmate has not agreed to the second.
 *    /auth/ and /verify-email carry one-time tokens for the same reason.
 */
export const DISALLOWED_PREFIXES = [
	'/analytics',
	'/articles/',
	'/audio/',
	'/auth/',
	'/chat',
	'/courses/',
	'/dashboard',
	'/documents',
	'/flashcards',
	'/glossary',
	'/groups',
	'/insights',
	'/library',
	'/materials',
	'/mistakes',
	'/notes',
	'/offline',
	'/planner',
	'/practice',
	'/quizzes',
	'/reinforcement-center',
	'/search',
	'/settings',
	'/share/',
	'/spaces',
	'/summarizer',
	'/today',
	'/tutor',
	'/verify-email',
	'/videos',
	'/youtube',
]

/**
 * Crawlers that exist to build a link-preview card, not a search index.
 *
 * They need /share/ — a share link is worth pasting into a chat or a post, and the API renders
 * that route with the share's own title, summary snippet and contents (see
 * StudyPlatform.API/Controllers/SharePreviewController.cs). Several of these fetch strictly
 * according to robots.txt (Twitterbot and facebookexternalhit document that they do), so the
 * blanket Disallow above would otherwise leave every share link unfurling as a bare URL.
 *
 * Letting an unfurler read a link someone deliberately pasted is not the same as letting a search
 * engine index it: the User-agent: * group still keeps /share/ out of search results, and the page
 * itself carries a googlebot noindex.
 */
const LINK_PREVIEW_AGENTS = [
	'Twitterbot',
	'facebookexternalhit',
	'Facebot',
	'LinkedInBot',
	'Slackbot',
	'Slackbot-LinkExpanding',
	'WhatsApp',
	'TelegramBot',
	'Discordbot',
	'redditbot',
	'Pinterestbot',
	'SkypeUriPreview',
	'Iframely',
	'Embedly',
	// WeChat's unfurler identifies itself by the MicroMessenger product token; QQ and Weibo build
	// the same kind of card and are the other two links get pasted into from the same phone.
	'MicroMessenger',
	'WeChat',
	'QQ',
	'Weibo',
]

/**
 * index.html writes its absolute URLs as `%VITE_SHARE_BASE_URL%/…`. Vite substitutes that itself,
 * but when the variable is unset it only warns and leaves the placeholder in the output — so a
 * build without an origin used to ship `og:image="%VITE_SHARE_BASE_URL%/share.png"`, which is not
 * a URL at all. deploy.sh always passes the origin, so production was never affected; this is the
 * guard for every other way the file gets built.
 */
const ORIGIN_PLACEHOLDER = '%VITE_SHARE_BASE_URL%'

/**
 * A <meta content> / <link href> built on the placeholder. Matched by the placeholder rather than
 * by tag name so a newly added og:/twitter: tag is covered without touching this file.
 */
const PLACEHOLDER_URL_TAG = new RegExp(
	`[ \\t]*<(?:meta|link)\\b[^>]*?(?:content|href)\\s*=\\s*"${ORIGIN_PLACEHOLDER}[^"]*"[^>]*>\\s*`,
	'gi',
)

/**
 * Resolves index.html's origin placeholders to `origin`.
 *
 * og:image, og:url, twitter:image and canonical are only meaningful as absolute URLs — a crawler
 * reads them off-site, where a relative path resolves against the wrong host or not at all. Without
 * an origin there is no absolute URL to emit, so those tags are dropped rather than shipped broken:
 * a link that unfurls plainly beats one that unfurls to a 404 image. Placeholders anywhere else
 * (the ld+json url, the crawler thumbnail's src) degrade to a same-origin relative path, which the
 * browser and the crawler both resolve correctly from the page they already fetched.
 */
const resolveOrigin = (html: string, origin: string): string => {
	if (origin) return html.split(ORIGIN_PLACEHOLDER).join(origin)

	console.warn(
		`(!) ${ORIGIN_PLACEHOLDER} is unset — dropping the og:/twitter:/canonical tags that require ` +
			'an absolute URL. Pass VITE_SHARE_BASE_URL to build a shell with working link previews.',
	)
	return html.replace(PLACEHOLDER_URL_TAG, '').split(ORIGIN_PLACEHOLDER).join('')
}

/** Escapes text for XML (the sitemap) and for HTML text and attribute values alike. */
const escapeMarkup = (value: string): string =>
	value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const buildRobotsTxt = (origin: string): string => {
	// Anything not matched by a Disallow is crawlable by default, so "/" and the auth pages in
	// SITEMAP_ROUTES need no explicit Allow.
	const lines = ['User-agent: *', ...DISALLOWED_PREFIXES.map((p) => `Disallow: ${p}`)]

	// A crawler obeys only the group that names it, so the preview agents need the whole list
	// repeated back with /share/ taken out of it. Consecutive User-agent lines share one rule
	// block, which is what keeps that from being fourteen copies of it.
	lines.push(
		'',
		...LINK_PREVIEW_AGENTS.map((agent) => `User-agent: ${agent}`),
		...DISALLOWED_PREFIXES.filter((p) => p !== '/share/').map((p) => `Disallow: ${p}`),
	)

	if (origin) lines.push('', `Sitemap: ${origin}/sitemap.xml`)
	return `${lines.join('\n')}\n`
}

const buildSitemapXml = (origin: string, lastmod: string): string => {
	const urls = SITEMAP_ROUTES.map(({ path, changefreq, priority }) => {
		// The root is "<origin>/", every other route is "<origin><path>" with no trailing slash,
		// matching the canonical link the app itself emits.
		const loc = path === '/' ? `${origin}/` : `${origin}${path}`
		return [
			'\t<url>',
			`\t\t<loc>${escapeMarkup(loc)}</loc>`,
			`\t\t<lastmod>${lastmod}</lastmod>`,
			`\t\t<changefreq>${changefreq}</changefreq>`,
			`\t\t<priority>${priority}</priority>`,
			'\t</url>',
		].join('\n')
	}).join('\n')

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** Where index.html's <noscript> gets the list of feature page links. */
const FEATURE_LINKS_MARKER = '<!-- seo:feature-page-links -->'

const featureLinksHtml = (indent: string): string =>
	[
		`${indent}<h2>Study tools</h2>`,
		`${indent}<ul>`,
		...FEATURE_PAGES.map(
			(p) => `${indent}\t<li><a href="${featurePagePath(p.slug)}">${escapeMarkup(p.navLabel)}</a></li>`,
		),
		`${indent}</ul>`,
	].join('\n')

/**
 * Replaces the content attribute of every <meta> whose name/property is one of `keys`. Matched on
 * the attribute rather than the whole tag because index.html wraps long tags across lines.
 */
const setMetaContent = (html: string, keys: string[], value: string): string =>
	keys.reduce(
		(out, key) =>
			out.replace(
				new RegExp(`(<meta\\b[^>]*?\\b(?:name|property)="${key}"[^>]*?\\bcontent=")[^"]*(")`, 'g'),
				`$1${escapeMarkup(value)}$2`,
			),
		html,
	)

/**
 * Swaps exactly one match of `pattern`. Throws when there is none: a page silently keeping the
 * homepage's title or copy is the duplicate-content failure this whole file exists to avoid, so a
 * reshaped index.html should break the build rather than ship it.
 */
const replaceRequired = (html: string, pattern: RegExp, replacement: string, what: string): string => {
	if (!pattern.test(html)) throw new Error(`vite-plugin-seo: index.html has no ${what} to replace`)
	return html.replace(pattern, () => replacement)
}

const featurePageJsonLd = (page: FeaturePageContent, origin: string): string => {
	const url = `${origin}${featurePagePath(page.slug)}`
	const graph = [
		{
			'@type': 'WebPage',
			'@id': `${url}#webpage`,
			url,
			name: page.title,
			description: page.description,
			isPartOf: { '@id': `${origin}/#website` },
			about: { '@id': `${origin}/#app` },
		},
		{
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ '@type': 'ListItem', position: 1, name: 'Toto Study', item: `${origin}/` },
				{ '@type': 'ListItem', position: 2, name: page.navLabel, item: url },
			],
		},
		{
			'@type': 'FAQPage',
			mainEntity: page.faqs.map((f) => ({
				'@type': 'Question',
				name: f.question,
				acceptedAnswer: { '@type': 'Answer', text: f.answer },
			})),
		},
	]
	// "</" inside a JSON string would close the <script> early; none of the copy has one, but escape it anyway.
	const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, '\t').replace(/<\//g, '<\\/')
	return `<script type="application/ld+json">\n${json}\n\t\t</script>`
}

const featurePageNoscript = (page: FeaturePageContent): string => {
	const i = '\t\t\t'
	const lines = [
		'<noscript>',
		`${i}<h1>${escapeMarkup(page.h1)}</h1>`,
		`${i}<p>${escapeMarkup(page.intro)}</p>`,
		`${i}<h2>How it works</h2>`,
		`${i}<ol>`,
		...page.steps.map((step) => `${i}\t<li>${escapeMarkup(step)}</li>`),
		`${i}</ol>`,
		...page.sections.flatMap((sec) => [
			`${i}<h2>${escapeMarkup(sec.heading)}</h2>`,
			`${i}<p>${escapeMarkup(sec.body)}</p>`,
			...(sec.example ? [`${i}<blockquote>${escapeMarkup(sec.example.label)}: ${escapeMarkup(sec.example.text)}</blockquote>`] : []),
		]),
		...(page.examples?.length
			? [
					`${i}<h2>Real examples</h2>`,
					...page.examples.flatMap((ex) => [
						`${i}<h3><a href="${ex.sharePath}">${escapeMarkup(ex.title)}</a></h3>`,
						`${i}<p>${escapeMarkup(ex.excerpt)}</p>`,
					]),
				]
			: []),
		`${i}<h2>Frequently asked questions</h2>`,
		...page.faqs.flatMap((f) => [`${i}<h3>${escapeMarkup(f.question)}</h3>`, `${i}<p>${escapeMarkup(f.answer)}</p>`]),
		`${i}<p><a href="/register">Create a free Toto Study account</a> or <a href="/">see everything Toto Study does</a>.</p>`,
		featureLinksHtml(i),
		'\t\t</noscript>',
	]
	return lines.join('\n')
}

/**
 * The built index.html, re-headed and re-worded for one feature page. Everything else (the script
 * and style tags pointing at this build's hashed assets) stays byte for byte, so the SPA boots and
 * renders the same page on top.
 */
export const renderFeaturePageHtml = (shell: string, page: FeaturePageContent, origin: string): string => {
	const url = `${origin}${featurePagePath(page.slug)}`
	let html = replaceRequired(shell, /<title>[\s\S]*?<\/title>/, `<title>${escapeMarkup(page.title)}</title>`, '<title>')
	html = replaceRequired(
		html,
		/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
		featurePageJsonLd(page, origin),
		'ld+json block',
	)
	html = replaceRequired(html, /<noscript>[\s\S]*?<\/noscript>/, featurePageNoscript(page), '<noscript>')
	if (!/<meta\b[^>]*?\bname="description"/.test(html)) {
		throw new Error('vite-plugin-seo: index.html has no meta description to replace')
	}
	html = setMetaContent(html, ['description', 'og:description', 'twitter:description', 'wechat:description'], page.description)
	html = setMetaContent(html, ['og:title', 'twitter:title', 'wechat:title'], page.title)
	// Present only on a build with an origin (resolveOrigin drops them otherwise).
	html = setMetaContent(html, ['og:url'], url)
	return html.replace(/(<link\b[^>]*?\brel="canonical"[^>]*?\bhref=")[^"]*(")/, `$1${escapeMarkup(url)}$2`)
}

export type SeoPluginOptions = {
	/** VITE_SHARE_BASE_URL — the public origin. Empty on a local build, which skips the sitemap. */
	origin?: string
	/**
	 * VITE_GOOGLE_SITE_VERIFICATION — the token from the Search Console "HTML tag" method, i.e.
	 * only the content="..." value, not the whole <meta> element. Unset omits the tag entirely.
	 */
	googleSiteVerification?: string
}

export function seoPlugin({ origin = '', googleSiteVerification = '' }: SeoPluginOptions): Plugin {
	// Trailing slashes would double up when concatenated onto a route path.
	const baseUrl = origin.replace(/\/+$/, '')
	const token = googleSiteVerification.trim()

	return {
		name: 'study-platform:seo',
		apply: 'build',

		transformIndexHtml: {
			// Ahead of Vite's own %VAR% substitution, so the placeholders are already resolved (or
			// their tags already gone) by the time it would warn about them.
			order: 'pre',
			handler(html) {
				// Search Console reads this on the homepage. S3 serves index.html for every path,
				// so it lands site-wide, which the verifier is fine with.
				const tags: HtmlTagDescriptor[] = token
					? [
							{
								tag: 'meta',
								attrs: { name: 'google-site-verification', content: token },
								injectTo: 'head',
							},
						]
					: []

				const indent = html.match(new RegExp(`([ \\t]*)${FEATURE_LINKS_MARKER}`))?.[1] ?? ''
				const withLinks = html.replace(FEATURE_LINKS_MARKER, featureLinksHtml(indent).trimStart())
				return { html: resolveOrigin(withLinks, baseUrl), tags }
			},
		},

		generateBundle() {
			this.emitFile({ type: 'asset', fileName: 'robots.txt', source: buildRobotsTxt(baseUrl) })

			if (!baseUrl) {
				// A sitemap needs absolute URLs, so there is nothing valid to emit without an origin.
				// Local builds hit this; deploy.sh always passes VITE_SHARE_BASE_URL.
				this.warn('VITE_SHARE_BASE_URL is unset — skipping sitemap.xml')
				return
			}

			const lastmod = new Date().toISOString().slice(0, 10)
			this.emitFile({
				type: 'asset',
				fileName: 'sitemap.xml',
				source: buildSitemapXml(baseUrl, lastmod),
			})
		},

		// After Vite has written index.html, so each page starts from the finished shell with this
		// build's asset hashes already in it.
		writeBundle(options) {
			const outDir = options.dir ?? path.resolve('dist')
			const shell = readFileSync(path.join(outDir, 'index.html'), 'utf8')
			for (const page of FEATURE_PAGES) {
				const dir = path.join(outDir, page.slug)
				mkdirSync(dir, { recursive: true })
				writeFileSync(path.join(dir, 'index.html'), renderFeaturePageHtml(shell, page, baseUrl))
			}
		},
	}
}
