import { useEffect, useRef, useState } from 'react'
import { Markdown } from '../components/Markdown'
import { Spinner } from '../components/Spinner'
import type { ChatMessage } from '../hooks'

interface Props {
	chat: { messages: ChatMessage[]; sending: boolean; send: (text: string) => void }
}

export function ChatTab({ chat }: Props) {
	const { messages, sending, send } = chat
	const [input, setInput] = useState('')
	const scrollRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
	}, [messages, sending])

	const submit = (e: React.FormEvent) => {
		e.preventDefault()
		const text = input.trim()
		if (!text || sending) return
		setInput('')
		send(text)
	}

	return (
		<div className="es-pane es-chat">
			<div className="es-messages es-scroll" ref={scrollRef}>
				{messages.length === 0 && (
					<div className="es-empty">
						Ask anything about this video — its content, key points, or for an explanation.
					</div>
				)}
				{messages.map((m, i) =>
					m.role === 'assistant' ? (
						<Markdown key={i} text={m.content} className="es-msg es-msg-assistant" />
					) : (
						<div key={i} className="es-msg es-msg-user">
							{m.content}
						</div>
					),
				)}
				{sending && (
					<div className="es-msg es-msg-assistant es-typing">
						<Spinner /> thinking…
					</div>
				)}
			</div>
			<form className="es-chat-form" onSubmit={submit}>
				<input
					className="es-chat-input"
					placeholder="Ask about this video…"
					autoComplete="off"
					value={input}
					onChange={(e) => setInput(e.target.value)}
				/>
				<button className="es-btn" type="submit" disabled={sending}>
					Send
				</button>
			</form>
		</div>
	)
}
