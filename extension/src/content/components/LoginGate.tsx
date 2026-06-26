import { LogIn, UserPlus } from 'lucide-react'
import { send } from '../../lib/messaging'

// Shown in the panel body when the user isn't signed in. The extension never
// collects credentials itself — it hands off to the Easy Study web app's login
// / register pages, and the content bridge mirrors the resulting token back so
// the same account and data are shared between the web app and the panel.
export function LoginGate() {
	const open = (path: string) => send({ type: 'ES_OPEN_APP', path })

	return (
		<div className="es-gate">
			<img className="es-gate-logo" src={chrome.runtime.getURL('icon128.png')} alt="Easy Study" />
			<h3 className="es-gate-title">Sign in to Easy Study</h3>
			<p className="es-gate-sub">
				Log in to summarize videos, chat, and save notes. Your library is shared with the web app.
			</p>
			<div className="es-gate-actions">
				<button className="es-btn es-gate-btn" onClick={() => open('/login')}>
					<LogIn size={15} />
					Log in
				</button>
				<button className="es-btn es-btn-ghost es-gate-btn" onClick={() => open('/register')}>
					<UserPlus size={15} />
					Create account
				</button>
			</div>
			<p className="es-gate-hint">Opens Easy Study in a new tab. Come back here once you're signed in.</p>
		</div>
	)
}
