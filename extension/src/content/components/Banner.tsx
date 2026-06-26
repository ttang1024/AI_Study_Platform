import { send, type Status } from '../../lib/messaging'

// Setup prompt shown above the tabs when the signed-in user still needs an AI
// provider key. (The signed-out case is handled by the LoginGate instead.)
export function Banner({ status }: { status: Status | null }) {
	if (!status || !status.connected) return null
	if (!status.hasAi) {
		return (
			<div className="es-banner es-banner-warn">
				<span>Add an AI provider key to enable summaries &amp; chat.</span>
				<button className="es-link-btn" onClick={() => send({ type: 'ES_OPEN_APP', path: '/settings' })}>
					Open settings
				</button>
			</div>
		)
	}
	return null
}
