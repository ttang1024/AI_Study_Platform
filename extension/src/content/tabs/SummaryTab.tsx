import { SummaryMarkdown } from '../components/SummaryMarkdown'
import { Loading } from '../components/Spinner'
import { copyText } from '../../lib/util'

interface Props {
	summary: { text: string; loading: boolean; error: string | null; regenerate: () => void }
}

export function SummaryTab({ summary }: Props) {
	const { text, loading, error, regenerate } = summary

	return (
		<div className="es-pane">
			<div className="es-toolbar">
				<button className="es-btn" onClick={regenerate} disabled={loading}>
					{text ? '↻ Regenerate' : '✨ Generate summary'}
				</button>
				<button className="es-btn es-btn-ghost" onClick={() => copyText(text)} disabled={!text}>
					⧉ Copy
				</button>
			</div>
			<div className="es-markdown es-scroll">
				{error ? (
					<div className="es-error">{error}</div>
				) : !text && loading ? (
					<Loading label="Reading transcript & summarizing…" />
				) : !text ? (
					<div className="es-empty">
						No summary yet. Click <b>Generate summary</b>.
					</div>
				) : (
					<div className="es-summary">
						<SummaryMarkdown text={text} />
						{loading && <span className="es-caret" />}
					</div>
				)}
			</div>
		</div>
	)
}
