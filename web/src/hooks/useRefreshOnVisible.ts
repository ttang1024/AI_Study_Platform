import { useEffect, useRef } from 'react';

export function useRefreshOnVisible(refresh: () => void | Promise<void>, minIntervalMs = 1000) {
	const refreshRef = useRef(refresh);
	const lastRefreshRef = useRef(0);
	const wasHiddenRef = useRef(document.visibilityState === 'hidden');

	useEffect(() => {
		refreshRef.current = refresh;
	}, [refresh]);

	useEffect(() => {
		const refreshIfVisible = () => {
			if (document.visibilityState === 'hidden') {
				wasHiddenRef.current = true;
				return;
			}
			if (!wasHiddenRef.current) return;
			wasHiddenRef.current = false;
			const now = Date.now();
			if (now - lastRefreshRef.current < minIntervalMs) return;
			lastRefreshRef.current = now;
			void refreshRef.current();
		};

		document.addEventListener('visibilitychange', refreshIfVisible);

		return () => {
			document.removeEventListener('visibilitychange', refreshIfVisible);
		};
	}, [minIntervalMs]);
}
