// Tiny, dependency-free Markdown → HTML renderer for summaries & chat replies.
// Escapes HTML first, then applies a safe subset (headings, bold/italic, code,
// lists, blockquotes, http links, hr). Not full CommonMark — good enough for
// AI prose, and avoids pulling a markdown library into the bundle.

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(s: string): string {
	s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
	s = s.replace(
		/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
		(_, t, u) => `<a href="${u}" target="_blank" rel="noreferrer noopener">${t}</a>`,
	)
	s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
	s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
	s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
	return s
}

export function renderMarkdown(md: string): string {
	if (!md) return ''
	const lines = escapeHtml(md).split('\n')
	const out: string[] = []
	let listType: 'ul' | 'ol' | null = null
	let inCode = false
	let codeBuf: string[] = []

	const closeList = () => {
		if (listType) {
			out.push(`</${listType}>`)
			listType = null
		}
	}

	for (const line of lines) {
		if (/^\s*```/.test(line)) {
			if (inCode) {
				out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
				codeBuf = []
				inCode = false
			} else {
				closeList()
				inCode = true
			}
			continue
		}
		if (inCode) {
			codeBuf.push(line)
			continue
		}
		if (/^\s*$/.test(line)) {
			closeList()
			continue
		}

		let m: RegExpMatchArray | null
		if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
			closeList()
			const level = m[1].length
			out.push(`<h${level}>${inline(m[2])}</h${level}>`)
		} else if (/^\s*(---|\*\*\*|___)\s*$/.test(line)) {
			closeList()
			out.push('<hr>')
		} else if ((m = line.match(/^\s*>\s?(.*)$/))) {
			closeList()
			out.push(`<blockquote>${inline(m[1])}</blockquote>`)
		} else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
			if (listType !== 'ul') {
				closeList()
				out.push('<ul>')
				listType = 'ul'
			}
			out.push(`<li>${inline(m[1])}</li>`)
		} else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
			if (listType !== 'ol') {
				closeList()
				out.push('<ol>')
				listType = 'ol'
			}
			out.push(`<li>${inline(m[1])}</li>`)
		} else {
			closeList()
			out.push(`<p>${inline(line)}</p>`)
		}
	}
	if (inCode) out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`)
	closeList()
	return out.join('\n')
}
