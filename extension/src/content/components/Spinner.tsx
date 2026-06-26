export function Spinner() {
	return <span className="es-spinner" />
}

export function Loading({ label }: { label: string }) {
	return (
		<div className="es-loading">
			<Spinner /> {label}
		</div>
	)
}
