import { useCallback, useEffect, useState } from 'react'
import { send } from '../../lib/messaging'
import type { ChatAttachmentPayload, ConversationSummary } from '../../lib/messaging'

// ── chat ────────────────────────────────────────────────────────────────────

// An attachment to send with the next turn (base64, mirrors the API payload).
export interface ChatAttachment extends ChatAttachmentPayload {}

// An attachment shown on a message: base64 for this session's sends, a
// presigned URL for turns loaded from the persisted history.
export interface ChatMessageAttachment {
	mimeType: string
	fileName?: string
	data?: string
	url?: string
}

export interface ChatMessage {
	role: 'user' | 'assistant'
	content: string
	attachments?: ChatMessageAttachment[]
}

export type { ConversationSummary }

// Per-video chat with multiple persisted threads — the same conversations the
// web app's video page shows. `conversationId === null` means a fresh thread
// that is created on its first send.
export function useChat(videoId: string | null) {
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [conversations, setConversations] = useState<ConversationSummary[]>([])
	const [conversationId, setConversationId] = useState<string | null>(null)
	const [sending, setSending] = useState(false)

	const refreshConversations = useCallback(async () => {
		if (!videoId) return
		const res = await send<{ ok: boolean; conversations?: ConversationSummary[] }>({
			type: 'ES_CHAT_CONVERSATIONS',
			videoId,
		})
		if (res.ok) setConversations(res.conversations || [])
	}, [videoId])

	// Reset per video, then resume the most recent thread.
	useEffect(() => {
		setMessages([])
		setConversations([])
		setConversationId(null)
		setSending(false)
		if (!videoId) return
		let stale = false
		;(async () => {
			const res = await send<{ ok: boolean; conversations?: ConversationSummary[] }>({
				type: 'ES_CHAT_CONVERSATIONS',
				videoId,
			})
			if (stale || !res.ok || !res.conversations?.length) return
			setConversations(res.conversations)
			const latest = res.conversations[0]
			setConversationId(latest.conversationId)
			const msgs = await send<{ ok: boolean; messages?: ChatMessage[] }>({
				type: 'ES_CHAT_MESSAGES',
				videoId,
				conversationId: latest.conversationId,
			})
			if (!stale && msgs.ok) setMessages(msgs.messages || [])
		})()
		return () => {
			stale = true
		}
	}, [videoId])

	const selectConversation = useCallback(
		async (id: string) => {
			if (!videoId || id === conversationId) return
			setConversationId(id)
			setMessages([])
			const msgs = await send<{ ok: boolean; messages?: ChatMessage[] }>({
				type: 'ES_CHAT_MESSAGES',
				videoId,
				conversationId: id,
			})
			if (msgs.ok) setMessages(msgs.messages || [])
		},
		[videoId, conversationId],
	)

	const newConversation = useCallback(() => {
		setConversationId(null)
		setMessages([])
	}, [])

	const deleteConversation = useCallback(
		async (id: string) => {
			if (!videoId) return
			const res = await send<{ ok: boolean; error?: string }>({
				type: 'ES_CHAT_DELETE_CONVERSATION',
				videoId,
				conversationId: id,
			})
			if (!res.ok) return
			setConversations((cur) => cur.filter((c) => c.conversationId !== id))
			if (id === conversationId) {
				setConversationId(null)
				setMessages([])
			}
		},
		[videoId, conversationId],
	)

	const send_ = useCallback(
		async (text: string, attachments?: ChatAttachment[]) => {
			if (!videoId || (!text.trim() && !attachments?.length) || sending) return
			// History only matters for the stateless fallback; the persisting
			// endpoint reads it from the DB.
			const history = messages.map((m) => ({ role: m.role, content: m.content }))
			setMessages((m) => [...m, { role: 'user', content: text, attachments }])
			setSending(true)
			const res = await send<{ ok: boolean; reply?: string; error?: string; conversationId?: string | null }>({
				type: 'ES_CHAT',
				videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
				message: text,
				history,
				attachments,
				conversationId,
			})
			setSending(false)
			setMessages((m) => [...m, { role: 'assistant', content: res.ok ? res.reply || '' : `⚠️ ${res.error}` }])
			if (res.ok) {
				if (res.conversationId) setConversationId(res.conversationId)
				refreshConversations() // pick up auto-title / counts / ordering
			}
		},
		[videoId, sending, messages, conversationId, refreshConversations],
	)

	return {
		messages,
		sending,
		send: send_,
		conversations,
		conversationId,
		selectConversation,
		newConversation,
		deleteConversation,
	}
}
