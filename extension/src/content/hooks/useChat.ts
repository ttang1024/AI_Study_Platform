import { useCallback, useEffect, useState } from 'react'
import { send } from '../../lib/messaging'

// ── chat ────────────────────────────────────────────────────────────────────
export interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
}

export function useChat(videoId: string | null) {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [sending, setSending] = useState(false)

	useEffect(() => {
		setMessages([])
		setSending(false)
	}, [videoId])

	const send_ = useCallback(
		async (text: string) => {
			if (!videoId || !text.trim() || sending) return
			const history = messages.map((m) => ({ role: m.role, content: m.content }))
			setMessages((m) => [...m, { role: 'user', content: text }])
			setSending(true)
			const res = await send<{ ok: boolean; reply?: string; error?: string }>({
				type: 'ES_CHAT',
				videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
				message: text,
				history,
			})
			setSending(false)
			setMessages((m) => [...m, { role: 'assistant', content: res.ok ? res.reply || '' : `⚠️ ${res.error}` }])
		},
		[videoId, sending, messages],
	)

	return { messages, sending, send: send_ }
}
