// Easy Study — service worker entry.
//
// All network calls to the Easy Study API happen here, in the extension's
// privileged context, so they bypass page CORS and can carry the HttpOnly
// refresh-token cookie. Content scripts talk to this worker over messages.
//
// Auth model (mirrors the web app):
//   • access token  — short-lived JWT, synced from the app's localStorage by
//                     content/bridge.ts, or minted here via the refresh cookie.
//   • refresh token — HttpOnly cookie on the API origin (SameSite=None), sent
//                     automatically on a credentials:'include' fetch.
//   • AI settings   — provider / model / key, synced from the app so the same
//                     X-AI-* headers the web app sends are reused here.
//
// This module is just the chrome wiring; the work lives in sibling modules:
//   config · jwt · auth · api · library · handlers · streaming

import { friendlyError } from './api'
import { setAiSettings, setToken } from './config'
import { handleCaptureTab, handleChat, handleOpenApp, handleClip, handleSaveFlashcard, handleStatus, handleTranscript } from './handlers'
import { handleChatConversations, handleChatMessages, handleDeleteChatConversation, handleLibrary } from './library'
import { startStream } from './streaming'

// ── one-shot request/response messages ──────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	;(async () => {
		try {
			switch (msg?.type) {
				case 'ES_SYNC':
					if (msg.token) await setToken(msg.token)
					if (msg.ai) await setAiSettings(msg.ai)
					return sendResponse({ ok: true })
				case 'ES_STATUS':
					return sendResponse(await handleStatus())
				case 'ES_TRANSCRIPT':
					return sendResponse(await handleTranscript(msg.videoId))
				case 'ES_CHAT':
					return sendResponse(await handleChat(msg))
				case 'ES_LIBRARY':
					return sendResponse(await handleLibrary(msg.videoId))
				case 'ES_CHAT_CONVERSATIONS':
					return sendResponse(await handleChatConversations(msg.videoId))
				case 'ES_CHAT_MESSAGES':
					return sendResponse(await handleChatMessages(msg.videoId, msg.conversationId))
				case 'ES_CHAT_DELETE_CONVERSATION':
					return sendResponse(await handleDeleteChatConversation(msg.videoId, msg.conversationId))
				case 'ES_OPEN_APP':
					return sendResponse(await handleOpenApp(msg.path))
				case 'ES_CLIP':
					return sendResponse(await handleClip(msg.url))
				case 'ES_CAPTURE_TAB':
					return sendResponse(await handleCaptureTab(sender.tab?.windowId))
				default:
					return sendResponse({ ok: false, error: 'Unknown request.' })
			}
		} catch (e) {
			sendResponse(friendlyError(e))
		}
	})()
	return true // async response
})

// ── streaming text over a long-lived port (summary, mind map) ───────────────

chrome.runtime.onConnect.addListener((port) => {
	if (port.name !== 'es-stream') return
	const aborter = new AbortController()
	port.onDisconnect.addListener(() => aborter.abort())
	port.onMessage.addListener((m) => {
		// `kind` is 'summary' | 'mindmap'; we save the video first and stream the
		// persisting {id}/…/stream endpoint so the result is written to the DB.
		if (m?.type === 'start') startStream(m.kind, m.videoUrl, port, aborter.signal)
		if (m?.type === 'cancel') aborter.abort()
	})
})

// ── highlight → flashcard (right-click any selected text) ───────────────────

const FLASHCARD_MENU_ID = 'es-save-flashcard'

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: FLASHCARD_MENU_ID,
		title: 'Save selection as flashcard',
		contexts: ['selection'],
	})
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId !== FLASHCARD_MENU_ID || !info.selectionText) return
	;(async () => {
		const result = await handleSaveFlashcard(info.selectionText!, tab?.title ?? undefined, info.pageUrl).catch(friendlyError)
		const ok = (result as any)?.ok === true
		chrome.notifications.create({
			type: 'basic',
			iconUrl: 'icon128.png',
			title: ok ? 'Flashcard saved' : 'Couldn’t save flashcard',
			message: ok
				? 'The AI is on the back of the card — review it in Easy Study → Flashcards.'
				: ((result as any)?.error || 'Something went wrong.'),
		})
	})()
})
