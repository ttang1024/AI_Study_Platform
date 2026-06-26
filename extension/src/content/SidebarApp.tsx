import { useEffect, useState } from 'react'
import { Launcher } from './Launcher'
import { Panel } from './Panel'

// The single sidebar widget: shows the "Analyze" launcher card, and expands the
// full analysis panel inline (in place) when clicked — no slide-in drawer.
export function SidebarApp() {
	const [open, setOpen] = useState(false)

	// The toolbar popup can also toggle the panel (runtime message), and we keep
	// the legacy window event so any external trigger still works.
	useEffect(() => {
		const onWindowToggle = () => setOpen((o) => !o)
		const onRuntimeMsg = (m: any) => {
			if (m?.type === 'ES_TOGGLE_PANEL') setOpen((o) => !o)
		}
		window.addEventListener('ES_TOGGLE_PANEL', onWindowToggle)
		chrome.runtime.onMessage.addListener(onRuntimeMsg)
		return () => {
			window.removeEventListener('ES_TOGGLE_PANEL', onWindowToggle)
			chrome.runtime.onMessage.removeListener(onRuntimeMsg)
		}
	}, [])

	return open ? <Panel onClose={() => setOpen(false)} /> : <Launcher onOpen={() => setOpen(true)} />
}
