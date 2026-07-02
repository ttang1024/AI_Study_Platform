import { useCallback, useEffect, useState } from 'react'

// Read a chat message aloud with the browser's speech synthesis. Only one
// message plays at a time; toggling the playing message stops it.
export function useReadAloud() {
	const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
	const [speakingId, setSpeakingId] = useState<number | null>(null)

	useEffect(
		() => () => {
			if (supported) window.speechSynthesis.cancel()
		},
		[supported],
	)

	const toggle = useCallback(
		(id: number, text: string) => {
			if (!supported) return
			const synth = window.speechSynthesis
			if (speakingId === id) {
				synth.cancel()
				setSpeakingId(null)
				return
			}
			synth.cancel()
			const utterance = new SpeechSynthesisUtterance(text)
			utterance.lang = navigator.language || 'en-US'
			utterance.onend = () => setSpeakingId((cur) => (cur === id ? null : cur))
			utterance.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur))
			setSpeakingId(id)
			synth.speak(utterance)
		},
		[supported, speakingId],
	)

	return { supported, speakingId, toggle }
}
