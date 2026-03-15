interface PhasePlaceholderProps {
	title: string;
	phase: number;
	description: string;
}

export function PhasePlaceholder({ title, phase, description }: PhasePlaceholderProps) {
	return (
		<section className="rounded-2xl border border-storm-border bg-storm-z2 shadow-depth-1 p-6">
			<div className="inline-flex items-center rounded-full border border-storm-purple/30 bg-storm-purple/10 px-3 py-1 text-2xs font-semibold uppercase tracking-wider text-storm-glow">
				Phase {phase}
			</div>
			<h1 className="mt-4 text-2xl font-bold text-white">{title}</h1>
			<p className="mt-2 text-sm text-storm-muted max-w-2xl">{description}</p>
			<p className="mt-5 text-sm font-medium text-storm-subtle">Coming in Phase {phase}</p>
		</section>
	);
}
