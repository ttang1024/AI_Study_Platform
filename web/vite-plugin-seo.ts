import type { HtmlTagDescriptor, Plugin } from 'vite'

/**
 * Build-time SEO artifacts for the web SPA: robots.txt, sitemap.xml, and the optional
 * Google Search Console verification tag.
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
const DISALLOWED_PREFIXES = [
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

const xmlEscape = (value: string): string =>
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
			`\t\t<loc>${xmlEscape(loc)}</loc>`,
			`\t\t<lastmod>${lastmod}</lastmod>`,
			`\t\t<changefreq>${changefreq}</changefreq>`,
			`\t\t<priority>${priority}</priority>`,
			'\t</url>',
		].join('\n')
	}).join('\n')

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
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

				return { html: resolveOrigin(html, baseUrl), tags }
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
	}
}
