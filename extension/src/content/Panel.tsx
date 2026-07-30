import { useState } from 'react'
import { Sparkles, FileText, MessageCircle, type LucideIcon } from 'lucide-react'
import { send } from '../lib/messaging'
import { useChat, useLibrary, useStatus, useStreamText, useTranscript, useVideoId } from './hooks'
import { Banner } from './components/Banner'
import { LoginGate } from './components/LoginGate'
import { SummaryTab } from './tabs/SummaryTab'
import { TranscriptTab } from './tabs/TranscriptTab'
import { ChatTab } from './tabs/ChatTab'

type TabId = 'summary' | 'transcript' | 'chat'
// Mirrors the web video detail page's study tabs (icon + label), plus Transcript.
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
	{ id: 'transcript', label: 'Transcript', icon: FileText },
	{ id: 'summary', label: 'Summary', icon: Sparkles },
	{ id: 'chat', label: 'AI Chat', icon: MessageCircle },
]

// The analysis panel, rendered inline inside the YouTube sidebar (not a slide-in
// drawer). It's only mounted while expanded, so it's effectively always "open".
export function Panel({ onClose }: { onClose: () => void }) {
	const [tab, setTab] = useState<TabId>('summary')
	const videoId = useVideoId()

	const { status } = useStatus(true)
	// State lives here (above the tabs) so switching tabs never loses data;
	// each hook resets itself when videoId changes.
	// Pull any already-generated content from the user's library so tabs render
	// it straight from the DB rather than regenerating.
	const library = useLibrary(videoId, !!status?.connected)
	const transcript = useTranscript(videoId)
	const summary = useStreamText(videoId, 'summary', library.summary)
	const chat = useChat(videoId)

	const openInApp = () =>
		send({
			type: 'ES_OPEN_APP',
			path: `/library/add?tab=youtube&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
		})

	return (
		<div className="es-panel-embedded">
			<div className="es-header">
				<div className="es-brand">
					<img className="es-logo" src={chrome.runtime.getURL('icon128.png')} alt="Easy Study" />
					<span className="es-title">Easy Study</span>
				</div>
				<div className="es-header-actions">
					<button className="es-icon-btn" title="Open in Easy Study" onClick={openInApp}>
						↗
					</button>
					<button className="es-icon-btn" title="Collapse" onClick={onClose}>
						✕
					</button>
				</div>
			</div>

			{status && !status.connected ? (
				// Signed-out gate: hand off to the web app for login/registration,
				// then the bridge mirrors the token back and the panel unlocks.
				<LoginGate />
			) : (
				<>
					<Banner status={status} />

					<div className="es-tabs">
						{TABS.map(({ id, label, icon: Icon }) => (
							<button
								key={id}
								className={'es-tab' + (tab === id ? ' active' : '')}
								onClick={() => setTab(id)}
								title={label}
							>
								<Icon size={15} />
								<span>{label}</span>
							</button>
						))}
					</div>

					<div className="es-body">
						{tab === 'summary' && <SummaryTab summary={summary} />}
						{tab === 'transcript' && <TranscriptTab transcript={transcript} />}
						{tab === 'chat' && <ChatTab chat={chat} />}
					</div>
				</>
			)}
		</div>
	)
}
