import { useEffect, useState } from 'react'
import { send, type Status } from '../lib/messaging'

const DEFAULTS = { apiOrigin: 'http://localhost:5001', appOrigin: 'http://localhost:3000' }

async function activeTab() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
	return tab
}

// The bridge's bundled filename is hashed at build time, so look it up from the
// static manifest entry (the one targeting the app origin, not YouTube) rather
// than hardcoding a source path that won't exist in the built extension.
function bridgeScriptFile(): string | null {
	const scripts = chrome.runtime.getManifest().content_scripts || []
	const entry = scripts.find((c) => !(c.matches || []).some((m) => m.includes('youtube.com')))
	return entry?.js?.[0] || null
}

// Register the localStorage bridge on a custom app origin (the static manifest
// entry only covers localhost:3000).
async function registerBridge(appOrigin: string) {
	if (/^https?:\/\/localhost:3000$/i.test(appOrigin)) return
	const js = bridgeScriptFile()
	if (!js) return
	try {
		const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ['es-bridge-dynamic'] })
		if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: ['es-bridge-dynamic'] })
	} catch {}
	try {
		await chrome.scripting.registerContentScripts([
			{ id: 'es-bridge-dynamic', matches: [`${appOrigin}/*`], js: [js], runAt: 'document_start' },
		])
	} catch (e) {
		console.warn('Easy Study: could not register bridge', e)
	}
}

export function Popup() {
	const [status, setStatus] = useState<Status | null>(null)
	const [apiOrigin, setApiOrigin] = useState(DEFAULTS.apiOrigin)
	const [appOrigin, setAppOrigin] = useState(DEFAULTS.appOrigin)
	const [saved, setSaved] = useState<{ text: string; ok: boolean }>({ text: '', ok: true })

	const refreshStatus = () => send<Status>({ type: 'ES_STATUS' }).then(setStatus)

	useEffect(() => {
		chrome.storage.local.get(['apiOrigin', 'appOrigin']).then((cfg) => {
			setApiOrigin(cfg.apiOrigin || DEFAULTS.apiOrigin)
			setAppOrigin(cfg.appOrigin || DEFAULTS.appOrigin)
		})
		refreshStatus()
	}, [])

	const openApp = (path: string) => send({ type: 'ES_OPEN_APP', path }).then(() => window.close())

	const openPanel = async () => {
		const tab = await activeTab()
		if (tab?.url && /youtube\.com\/(watch|shorts)/.test(tab.url) && tab.id != null) {
			chrome.tabs.sendMessage(tab.id, { type: 'ES_TOGGLE_PANEL' }, () => void chrome.runtime.lastError)
		} else {
			await send({ type: 'ES_OPEN_APP', path: '/' })
		}
		window.close()
	}

	const clipPage = async () => {
		const tab = await activeTab()
		if (tab?.url && /^https?:/i.test(tab.url)) {
			await send({ type: 'ES_CLIP', url: tab.url })
			window.close()
		}
	}

	const save = async () => {
		const api = apiOrigin.trim().replace(/\/+$/, '') || DEFAULTS.apiOrigin
		const app = appOrigin.trim().replace(/\/+$/, '') || DEFAULTS.appOrigin
		try {
			const granted = await chrome.permissions.request({ origins: [`${api}/*`, `${app}/*`] })
			if (!granted) {
				setSaved({ text: 'Permission denied — panel may not reach those URLs.', ok: false })
				return
			}
		} catch {
			/* localhost is already granted; request can reject — ignore */
		}
		await chrome.storage.local.set({ apiOrigin: api, appOrigin: app })
		await registerBridge(app)
		setSaved({ text: 'Saved.', ok: true })
		refreshStatus()
		setTimeout(() => setSaved({ text: '', ok: true }), 2500)
	}

	const dot = !status?.connected ? 'warn' : !status.hasAi ? 'warn' : 'on'
	const statusLine = !status?.connected
		? ['Not signed in', 'Open Easy Study and log in']
		: !status.hasAi
			? [`Signed in${status.email ? ` as ${status.email}` : ''}`, 'No AI provider — add a key in Settings']
			: [`Connected${status.email ? ` · ${status.email}` : ''}`, `AI: ${status.provider || 'ready'}`]

	return (
		<div className="wrap">
			<div className="brand">
				<img className="logo" src={chrome.runtime.getURL('icon128.png')} alt="Easy Study" />
				<b>Easy Study</b>
			</div>

			<div className="status">
				<span className={`dot ${dot}`} />
				<div className="status-text">
					{statusLine[0]}
					<small>{statusLine[1]}</small>
				</div>
			</div>

			<div className="actions">
				{!status?.connected ? (
					// Signed out: hand off to the web app to log in or register; the
					// content bridge mirrors the token back so the account is shared.
					<>
						<button className="primary" onClick={() => openApp('/login')}>
							Log in
						</button>
						<button className="ghost" onClick={() => openApp('/register')}>
							Create account
						</button>
					</>
				) : (
					<>
						<button className="primary" onClick={openPanel}>
							Open video analyzer
						</button>
						<button className="ghost" onClick={clipPage}>
							Clip this page to library
						</button>
						<button className="ghost" onClick={() => openApp('/')}>
							Open Easy Study
						</button>
					</>
				)}
			</div>

			<details className="config">
				<summary>Settings</summary>
				<label htmlFor="app">Easy Study web app URL</label>
				<input id="app" value={appOrigin} onChange={(e) => setAppOrigin(e.target.value)} placeholder={DEFAULTS.appOrigin} />
				<label htmlFor="api">API URL</label>
				<input id="api" value={apiOrigin} onChange={(e) => setApiOrigin(e.target.value)} placeholder={DEFAULTS.apiOrigin} />
				<div className="save-row">
					<button className="primary" style={{ flex: 1 }} onClick={save}>
						Save
					</button>
				</div>
				<div className="saved" style={{ color: saved.ok ? '#16a34a' : '#dc2626' }}>
					{saved.text}
				</div>
				<p className="hint">
					Point these at your deployment. You'll be asked to grant access to non-localhost URLs so the panel can reach them.
				</p>
			</details>
		</div>
	)
}
