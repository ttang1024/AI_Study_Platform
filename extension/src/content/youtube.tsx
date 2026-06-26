import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { SidebarApp } from './SidebarApp'
// `?inline` gives us the compiled CSS as a string so we can scope it inside the
// shadow root (and HMR still updates it). A normal CSS import would leak styles
// into — and inherit styles from — the YouTube page.
import css from './panel.css?inline'

const LAUNCHER_HOST_ID = 'easy-study-launcher'

// Mount a React tree inside its own shadow root so YouTube's CSS can't reach in
// (and ours can't leak out).
function mountShadow(host: HTMLElement, node: ReactNode) {
	const shadow = host.attachShadow({ mode: 'open' })
	const root = document.createElement('div')
	shadow.appendChild(root)
	// Keystrokes inside the panel (e.g. Space in the chat box) bubble out of the
	// shadow root to YouTube's document-level hotkey handler, which sees the
	// shadow host — not our <input> — and fires player shortcuts (Space = pause).
	// React has already handled the event within the shadow tree by the time it
	// reaches the host, so we stop it here before it escapes to the page.
	const stop = (e: KeyboardEvent) => e.stopPropagation()
	for (const type of ['keydown', 'keyup', 'keypress'] as const) host.addEventListener(type, stop)
	createRoot(root).render(
		<StrictMode>
			<style>{css}</style>
			{node}
		</StrictMode>,
	)
}

// Embed the widget at the top of the watch-page sidebar (#secondary), above the
// recommendations — Monica-style. It shows the "Analyze" card and expands the
// full panel inline when clicked. Returns true once it's in place.
function mountLauncher(): boolean {
	if (location.pathname !== '/watch') return false
	if (document.getElementById(LAUNCHER_HOST_ID)) return true

	const sidebar =
		document.querySelector('#secondary #secondary-inner') || document.querySelector('#secondary')
	if (!sidebar) return false

	const host = document.createElement('div')
	host.id = LAUNCHER_HOST_ID
	host.style.cssText = 'all:initial; display:block; margin-bottom:12px;'
	sidebar.prepend(host)
	mountShadow(host, <SidebarApp />)
	return true
}

function removeLauncher() {
	document.getElementById(LAUNCHER_HOST_ID)?.remove()
}

mountLauncher()

// YouTube is a SPA: the sidebar is recreated on navigation and React subtrees we
// injected can be torn out. Re-embed the launcher whenever the DOM settles on a
// watch page, and drop it when we leave one. The cheap getElementById guard in
// mountLauncher keeps this from looping on its own mutations.
const observer = new MutationObserver(() => {
	if (location.pathname !== '/watch') removeLauncher()
	else mountLauncher()
})
observer.observe(document.documentElement, { childList: true, subtree: true })

window.addEventListener('yt-navigate-finish', () => {
	// The sidebar is rebuilt right after navigation; re-inject on the next ticks.
	if (location.pathname !== '/watch') {
		removeLauncher()
		return
	}
	if (!mountLauncher()) setTimeout(mountLauncher, 300)
})
