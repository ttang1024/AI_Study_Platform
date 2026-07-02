import { useCallback, useEffect, useRef, useState } from 'react'

// Chrome-only Web Speech API; not in lib.dom.d.ts, so typed loosely.
type SpeechRecognitionLike = {
	lang: string
	continuous: boolean
	interimResults: boolean
	start: () => void
	stop: () => void
	onresult: ((e: any) => void) | null
	onerror: ((e: any) => void) | null
	onend: (() => void) | null
}

function recognitionCtor(): (new () => SpeechRecognitionLike) | null {
	const w = window as any
	return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

// Dictate into the chat input. Final results stream out through onText;
// the mic keeps listening until toggled off (or the browser ends the session).
export function useVoiceInput(onText: (text: string) => void) {
	const supported = typeof window !== 'undefined' && !!recognitionCtor()
	const [listening, setListening] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const recRef = useRef<SpeechRecognitionLike | null>(null)
	const onTextRef = useRef(onText)
	onTextRef.current = onText

	useEffect(
		() => () => {
			recRef.current?.stop()
			recRef.current = null
		},
		[],
	)

	const toggle = useCallback(() => {
		if (listening) {
			recRef.current?.stop()
			return
		}
		const Ctor = recognitionCtor()
		if (!Ctor) {
			setError('Voice input isn’t supported in this browser.')
			return
		}
		setError(null)
		const rec = new Ctor()
		rec.lang = navigator.language || 'en-US'
		rec.continuous = true
		rec.interimResults = false
		rec.onresult = (e: any) => {
			let text = ''
			for (let i = e.resultIndex; i < e.results.length; i++) {
				if (e.results[i].isFinal) text += e.results[i][0].transcript
			}
			if (text.trim()) onTextRef.current(text.trim())
		}
		rec.onerror = (e: any) => {
			if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed')
				setError('Microphone access was blocked — allow it for youtube.com to dictate.')
			else if (e?.error && e.error !== 'aborted' && e.error !== 'no-speech')
				setError('Voice input failed — try again.')
		}
		rec.onend = () => {
			recRef.current = null
			setListening(false)
		}
		recRef.current = rec
		rec.start()
		setListening(true)
	}, [listening])

	return { supported, listening, error, toggle }
}
