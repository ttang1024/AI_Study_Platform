// The launcher is an *embedded* module that lives at the top of YouTube's
// right-hand column (#secondary), above the recommended videos — the same
// place Monica/Glasp put their entry point. It is NOT a floating overlay.
// Clicking "Analyze" expands the panel inline, right here in the sidebar.
export function Launcher({ onOpen }: { onOpen: () => void }) {
	return (
		<div className="es-launcher">
			<button className="es-launcher-main" onClick={onOpen} title="Analyze this video with Easy Study">
				<img className="es-logo" src={chrome.runtime.getURL('icon128.png')} alt="Easy Study" />
				<span className="es-launcher-copy">
					<span className="es-launcher-title">Easy Study</span>
					<span className="es-launcher-sub">AI summary, transcript, chat</span>
				</span>
				<span className="es-launcher-cta">Analyze</span>
			</button>
		</div>
	)
}
