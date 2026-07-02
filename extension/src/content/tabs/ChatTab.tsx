import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Copy, ImagePlus, Mic, MessageSquarePlus, Send, Square, Trash2, Volume2, X } from 'lucide-react'
import { Markdown } from '../components/Markdown'
import { Spinner } from '../components/Spinner'
import { markdownToPlainText } from '../../lib/markdown'
import { send } from '../../lib/messaging'
import { useReadAloud, useVoiceInput } from '../hooks'
import type { ChatAttachment, ChatMessage, ChatMessageAttachment, ConversationSummary } from '../hooks'

interface Props {
	chat: {
		messages: ChatMessage[]
		sending: boolean
		send: (text: string, attachments?: ChatAttachment[]) => void
		conversations: ConversationSummary[]
		conversationId: string | null
		selectConversation: (id: string) => void
		newConversation: () => void
		deleteConversation: (id: string) => void
	}
}

// Mirrors the backend's ChatAttachments limits.
const MAX_ATTACHMENTS = 8
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024

function dataUrlToAttachment(dataUrl: string, fileName?: string): ChatAttachment | null {
	const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s)
	return m ? { mimeType: m[1], data: m[2], fileName } : null
}

function fileToAttachment(file: File): Promise<ChatAttachment | null> {
	return new Promise((resolve) => {
		const reader = new FileReader()
		reader.onload = () => resolve(dataUrlToAttachment(String(reader.result), file.name))
		reader.onerror = () => resolve(null)
		reader.readAsDataURL(file)
	})
}

/** Grab the current video frame; fall back to a visible-tab capture if the canvas is tainted. */
async function captureScreenshot(): Promise<ChatAttachment | null> {
	const video =
		document.querySelector<HTMLVideoElement>('video.html5-main-video') ?? document.querySelector('video')
	if (video && video.videoWidth > 0) {
		try {
			const canvas = document.createElement('canvas')
			canvas.width = video.videoWidth
			canvas.height = video.videoHeight
			canvas.getContext('2d')!.drawImage(video, 0, 0)
			const shot = dataUrlToAttachment(canvas.toDataURL('image/jpeg', 0.85), 'video-frame.jpg')
			if (shot) return shot
		} catch {
			// Tainted canvas — fall through to the tab capture below.
		}
	}
	const res = await send<{ ok: boolean; dataUrl?: string; error?: string }>({ type: 'ES_CAPTURE_TAB' })
	return res.ok && res.dataUrl ? dataUrlToAttachment(res.dataUrl, 'screenshot.jpg') : null
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text)
		return true
	} catch {
		const ta = document.createElement('textarea')
		ta.value = text
		ta.style.position = 'fixed'
		ta.style.opacity = '0'
		document.body.appendChild(ta)
		ta.select()
		const ok = document.execCommand('copy')
		ta.remove()
		return ok
	}
}

// Full-size view in a new tab. Chrome blocks navigating a tab to a data: URL,
// so this session's base64 attachments open through a temporary blob URL.
function openAttachment(a: ChatMessageAttachment) {
	if (a.url) {
		window.open(a.url, '_blank', 'noopener')
		return
	}
	if (!a.data) return
	const bytes = atob(a.data)
	const buf = new Uint8Array(bytes.length)
	for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i)
	const blobUrl = URL.createObjectURL(new Blob([buf], { type: a.mimeType }))
	window.open(blobUrl, '_blank', 'noopener')
	window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

// Thumbnail for a message attachment: base64 for this session's sends, a
// presigned URL for history; click to view full-size. Falls back to a file
// chip when the image can't load (expired URL) or isn't an image (PDF).
function AttachmentThumb({ a }: { a: ChatMessageAttachment }) {
	const [failed, setFailed] = useState(false)
	const src = a.url ?? (a.data ? `data:${a.mimeType};base64,${a.data}` : null)
	if (!src || failed || !a.mimeType.startsWith('image/'))
		return <span className="es-attach-chip">📎 {a.fileName || 'attachment'}</span>
	return (
		<img
			className="es-msg-thumb"
			src={src}
			alt={a.fileName || 'attachment'}
			title="Open full size"
			onClick={() => openAttachment(a)}
			onError={() => setFailed(true)}
		/>
	)
}

export function ChatTab({ chat }: Props) {
	const {
		messages,
		sending,
		send: sendMessage,
		conversations,
		conversationId,
		selectConversation,
		newConversation,
		deleteConversation,
	} = chat
	const [input, setInput] = useState('')
	const [attachments, setAttachments] = useState<ChatAttachment[]>([])
	const [notice, setNotice] = useState<string | null>(null)
	const [copiedId, setCopiedId] = useState<number | null>(null)
	const [capturing, setCapturing] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)
	const fileRef = useRef<HTMLInputElement>(null)
	const noticeTimer = useRef<number>()

	const readAloud = useReadAloud()
	const voice = useVoiceInput((text) => setInput((v) => (v ? `${v.replace(/\s+$/, '')} ${text}` : text)))

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
	}, [messages, sending])

	const showNotice = (msg: string) => {
		setNotice(msg)
		window.clearTimeout(noticeTimer.current)
		noticeTimer.current = window.setTimeout(() => setNotice(null), 4000)
	}

	const addAttachments = (items: (ChatAttachment | null)[]) => {
		const valid = items.filter((a): a is ChatAttachment => !!a)
		if (!valid.length) return
		setAttachments((cur) => {
			if (cur.length + valid.length > MAX_ATTACHMENTS) showNotice(`Up to ${MAX_ATTACHMENTS} images per message.`)
			return [...cur, ...valid].slice(0, MAX_ATTACHMENTS)
		})
	}

	const onFiles = async (files: FileList | null) => {
		if (!files?.length) return
		const picked: (ChatAttachment | null)[] = []
		for (const file of Array.from(files)) {
			if (!file.type.startsWith('image/')) continue
			if (file.size > MAX_ATTACHMENT_BYTES) {
				showNotice(`${file.name} is over the 20 MB limit.`)
				continue
			}
			picked.push(await fileToAttachment(file))
		}
		addAttachments(picked)
	}

	const onScreenshot = async () => {
		setCapturing(true)
		const shot = await captureScreenshot()
		setCapturing(false)
		if (shot) addAttachments([shot])
		else showNotice('Couldn’t take a screenshot here.')
	}

	const onCopy = async (id: number, text: string) => {
		if (!(await copyText(text))) return
		setCopiedId(id)
		window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500)
	}

	const submit = (e: React.FormEvent) => {
		e.preventDefault()
		const text = input.trim()
		if ((!text && attachments.length === 0) || sending) return
		setInput('')
		setAttachments([])
		sendMessage(text, attachments.length ? attachments : undefined)
	}

	return (
		<div className="es-pane es-chat">
			{(conversations.length > 0 || conversationId) && (
				<div className="es-conv-bar">
					<select
						className="es-conv-select"
						value={conversationId ?? ''}
						onChange={(e) => (e.target.value ? selectConversation(e.target.value) : newConversation())}
						title="Conversation history"
					>
						{conversationId === null && <option value="">New conversation</option>}
						{conversations.map((c) => (
							<option key={c.conversationId} value={c.conversationId}>
								{c.title}
							</option>
						))}
					</select>
					<button
						type="button"
						className="es-tool-btn"
						title="Start a new conversation"
						onClick={newConversation}
						disabled={conversationId === null && messages.length === 0}
					>
						<MessageSquarePlus size={15} />
					</button>
					<button
						type="button"
						className="es-tool-btn"
						title="Delete this conversation"
						onClick={() => conversationId && deleteConversation(conversationId)}
						disabled={!conversationId}
					>
						<Trash2 size={15} />
					</button>
				</div>
			)}
			<div className="es-messages es-scroll" ref={scrollRef}>
				{messages.length === 0 && (
					<div className="es-empty">
						Ask anything about this video — its content, key points, or for an explanation.
					</div>
				)}
				{messages.map((m, i) => (
					<div key={i} className={'es-msg-group' + (m.role === 'user' ? ' es-msg-group-user' : '')}>
						{m.role === 'assistant' ? (
							<Markdown text={m.content} className="es-msg es-msg-assistant" />
						) : (
							<div className="es-msg es-msg-user">
								{!!m.attachments?.length && (
									<div className="es-msg-thumbs">
										{m.attachments.map((a, j) => (
											<AttachmentThumb key={j} a={a} />
										))}
									</div>
								)}
								{m.content}
							</div>
						)}
						<div className="es-msg-actions">
							<button
								className="es-msg-action"
								title={copiedId === i ? 'Copied' : 'Copy'}
								onClick={() => onCopy(i, m.content)}
							>
								{copiedId === i ? <Check size={13} /> : <Copy size={13} />}
							</button>
							{m.role === 'assistant' && readAloud.supported && (
								<button
									className={'es-msg-action' + (readAloud.speakingId === i ? ' active' : '')}
									title={readAloud.speakingId === i ? 'Stop reading' : 'Read aloud'}
									onClick={() => readAloud.toggle(i, markdownToPlainText(m.content))}
								>
									{readAloud.speakingId === i ? <Square size={13} /> : <Volume2 size={13} />}
								</button>
							)}
						</div>
					</div>
				))}
				{sending && (
					<div className="es-msg es-msg-assistant es-typing">
						<Spinner /> thinking…
					</div>
				)}
			</div>

			{(notice || voice.error) && <div className="es-chat-notice">{notice || voice.error}</div>}

			{attachments.length > 0 && (
				<div className="es-attach-strip">
					{attachments.map((a, i) => (
						<div key={i} className="es-attach-item">
							<img src={`data:${a.mimeType};base64,${a.data}`} alt={a.fileName || 'attachment'} />
							<button
								type="button"
								className="es-attach-remove"
								title="Remove"
								onClick={() => setAttachments((cur) => cur.filter((_, j) => j !== i))}
							>
								<X size={11} />
							</button>
						</div>
					))}
				</div>
			)}

			<form className="es-chat-form" onSubmit={submit}>
				<input
					ref={fileRef}
					type="file"
					accept="image/*"
					multiple
					hidden
					onChange={(e) => {
						onFiles(e.target.files)
						e.target.value = ''
					}}
				/>
				<button type="button" className="es-tool-btn" title="Attach images" onClick={() => fileRef.current?.click()}>
					<ImagePlus size={16} />
				</button>
				<button
					type="button"
					className="es-tool-btn"
					title="Screenshot the video"
					onClick={onScreenshot}
					disabled={capturing}
				>
					{capturing ? <Spinner /> : <Camera size={16} />}
				</button>
				{voice.supported && (
					<button
						type="button"
						className={'es-tool-btn' + (voice.listening ? ' es-mic-live' : '')}
						title={voice.listening ? 'Stop dictation' : 'Voice input'}
						onClick={voice.toggle}
					>
						<Mic size={16} />
					</button>
				)}
				<input
					className="es-chat-input"
					placeholder={voice.listening ? 'Listening…' : 'Ask about this video…'}
					autoComplete="off"
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<button className="es-btn es-send-btn" type="submit" disabled={sending} title="Send">
					<Send size={15} />
				</button>
			</form>
		</div>
	)
}
