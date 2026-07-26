import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Camera, CheckCircle2, HelpCircle, Loader2, PenLine, Trash2, X } from 'lucide-react';
import { GradePage, HandwritingGrade, StepVerdict, handwritingService } from '../../services/handwritingService';
import { getApiErrorCode } from '../../utils/apiError';
import { cn } from '../../utils/cn';

const MAX_PAGES = 8;
const MAX_PAGE_BYTES = 20 * 1024 * 1024;

interface Photo extends GradePage {
	/** Object URL for the thumbnail. Revoked when the photo is removed. */
	previewUrl: string;
}

/** How each step's verdict is presented. "consequent" is the interesting one — see below. */
const VERDICT_STYLE: Record<StepVerdict, { label: string; icon: React.ElementType; className: string }> = {
	correct: { label: 'Correct', icon: CheckCircle2, className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' },
	incorrect: { label: 'This is where it broke', icon: X, className: 'border-red-500/40 bg-red-500/5 text-red-600' },
	// A step that is wrong only because it faithfully carries an earlier mistake forward is not a
	// second mistake. Flagging it as one buries the actual error in a wall of red.
	consequent: { label: 'Follows from the error above', icon: AlertTriangle, className: 'border-amber-500/30 bg-amber-500/5 text-amber-600' },
	unclear: { label: 'Could not read', icon: HelpCircle, className: 'border-[var(--border-color)] bg-[var(--bg-card)] text-text-muted' },
};

export const HandwritingTab: React.FC = () => {
	const [photos, setPhotos] = useState<Photo[]>([]);
	const [problem, setProblem] = useState('');
	const [grade, setGrade] = useState<HandwritingGrade | null>(null);
	const [isGrading, setIsGrading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const addPhotos = useCallback(async (files: FileList | null) => {
		if (!files?.length) return;
		setError(null);

		const accepted: Photo[] = [];
		for (const file of Array.from(files).slice(0, MAX_PAGES - photos.length)) {
			if (!file.type.startsWith('image/')) {
				setError('Handwriting grading takes photos. Attach an image of the work.');
				continue;
			}
			if (file.size > MAX_PAGE_BYTES) {
				setError(`${file.name} is over the 20 MB limit.`);
				continue;
			}

			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = () => reject(reader.error);
				reader.readAsDataURL(file);
			});

			accepted.push({
				// The server tolerates a data: prefix, but strip it so the payload is just base64.
				data: dataUrl.slice(dataUrl.indexOf(',') + 1),
				mimeType: file.type,
				fileName: file.name,
				previewUrl: URL.createObjectURL(file),
			});
		}

		setPhotos(prev => [...prev, ...accepted]);
	}, [photos.length]);

	const removePhoto = (index: number) => {
		setPhotos(prev => {
			URL.revokeObjectURL(prev[index].previewUrl);
			return prev.filter((_, i) => i !== index);
		});
	};

	const submit = async () => {
		if (photos.length === 0 || isGrading) return;
		setIsGrading(true);
		setError(null);
		setGrade(null);

		try {
			const result = await handwritingService.grade(
				photos.map(({ data, mimeType, fileName }) => ({ data, mimeType, fileName })),
				problem,
			);
			setGrade(result);
		} catch (err) {
			setError(getApiErrorCode(err));
		} finally {
			setIsGrading(false);
		}
	};

	return (
		<div className="max-w-4xl space-y-6">
			<section className="space-y-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6">
				<div>
					<label htmlFor="problem" className="block text-sm font-semibold text-text-main">
						The problem <span className="font-normal text-text-muted">(optional)</span>
					</label>
					<p className="mt-0.5 text-xs text-text-muted">
						If it isn't written on the page, typing it here makes the grade markedly more reliable.
					</p>
					<textarea
						id="problem"
						value={problem}
						onChange={e => setProblem(e.target.value)}
						rows={2}
						placeholder="e.g. Solve for x: 2x² − 8x + 6 = 0"
						className="mt-2 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-sm text-text-main"
					/>
				</div>

				<div>
					<span className="block text-sm font-semibold text-text-main">Your working</span>
					<div className="mt-2 flex flex-wrap gap-3">
						{photos.map((photo, index) => (
							<div key={photo.previewUrl} className="group relative">
								<img
									src={photo.previewUrl}
									alt={photo.fileName ?? `Page ${index + 1}`}
									className="h-28 w-28 rounded-lg border border-[var(--border-color)] object-cover"
								/>
								<button
									type="button"
									onClick={() => removePhoto(index)}
									aria-label={`Remove page ${index + 1}`}
									className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
								>
									<Trash2 size={12} />
								</button>
							</div>
						))}

						{photos.length < MAX_PAGES && (
							<button
								type="button"
								onClick={() => fileInput.current?.click()}
								className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--border-color)] text-text-muted transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
							>
								<Camera size={20} />
								<span className="text-xs">Add photo</span>
							</button>
						)}
					</div>

					<input
						ref={fileInput}
						type="file"
						accept="image/*"
						multiple
						// On a phone this opens the camera directly.
						capture="environment"
						className="hidden"
						onChange={e => {
							void addPhotos(e.target.files);
							e.target.value = '';
						}}
					/>

					{photos.length > 1 && (
						<p className="mt-2 text-xs text-text-muted">
							{photos.length} pages — graded together as one continuous solution.
						</p>
					)}
				</div>

				{error && (
					<p className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-600">{error}</p>
				)}

				<button
					type="button"
					onClick={submit}
					disabled={photos.length === 0 || isGrading}
					className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
				>
					{isGrading ? <Loader2 className="animate-spin" size={16} /> : <PenLine size={16} />}
					{isGrading ? 'Reading your working…' : 'Check my working'}
				</button>
			</section>

			{grade && <GradeResult grade={grade} />}
		</div>
	);
};

const GradeResult: React.FC<{ grade: HandwritingGrade }> = ({ grade }) => (
	<motion.section
		initial={{ opacity: 0, y: 8 }}
		animate={{ opacity: 1, y: 0 }}
		className="space-y-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6"
	>
		<div
			className={cn(
				'rounded-xl border p-4',
				grade.isCorrect
					? 'border-emerald-500/30 bg-emerald-500/5'
					: 'border-amber-500/30 bg-amber-500/5',
			)}
		>
			<h2 className="flex items-center gap-2 font-bold text-text-main">
				{grade.isCorrect ? <CheckCircle2 className="text-emerald-600" size={18} /> : <AlertTriangle className="text-amber-600" size={18} />}
				{grade.isCorrect
					? 'This is correct all the way through'
					: grade.firstErrorStep != null
						? `The reasoning breaks at step ${grade.firstErrorStep}`
						: 'Something is off in this working'}
			</h2>
			<p className="mt-2 text-sm text-text-muted">{grade.summary}</p>
		</div>

		{grade.correctedStep && (
			<div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary)]/5 p-4">
				<h3 className="text-sm font-semibold text-text-main">What that step should have been</h3>
				<p className="mt-1 whitespace-pre-wrap text-sm text-text-muted">{grade.correctedStep}</p>
			</div>
		)}

		<ol className="space-y-2">
			{grade.steps.map(step => {
				const style = VERDICT_STYLE[step.verdict];
				const Icon = style.icon;
				return (
					<li key={step.step} className={cn('rounded-xl border p-4', style.className)}>
						<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
							<Icon size={14} />
							Step {step.step} — {style.label}
						</div>
						<p className="mt-2 whitespace-pre-wrap font-mono text-sm text-text-main">{step.text}</p>
						{step.comment && <p className="mt-1 text-sm text-text-muted">{step.comment}</p>}
					</li>
				);
			})}
		</ol>

		{grade.concepts.length > 0 && (
			<div>
				<h3 className="text-sm font-semibold text-text-main">Worth reviewing</h3>
				<ul className="mt-2 flex flex-wrap gap-2">
					{grade.concepts.map(concept => (
						<li
							key={concept}
							className="rounded-full border border-[var(--border-color)] px-3 py-1 text-xs text-text-muted"
						>
							{concept}
						</li>
					))}
				</ul>
			</div>
		)}
	</motion.section>
);

export default HandwritingTab;
