import { renderMarkdown } from '../../lib/markdown'

export function Markdown({ text, className }: { text: string; className?: string }) {
	return <div className={className ?? 'es-markdown'} dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
}
