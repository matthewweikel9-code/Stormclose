import { AlertCircle, Inbox, Loader2 } from "lucide-react";

type StateMessageProps = {
	title: string;
	description?: string;
};

export function LoadingState({ title, description }: StateMessageProps) {
	return (
		<div className="rounded-xl border border-storm-border bg-storm-z1 p-6 text-center">
			<div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-storm-z2">
				<Loader2 className="h-4 w-4 animate-spin text-storm-muted" />
			</div>
			<p className="text-sm font-medium text-white">{title}</p>
			{description ? <p className="mt-1 text-xs text-storm-muted">{description}</p> : null}
		</div>
	);
}

export function EmptyState({ title, description }: StateMessageProps) {
	return (
		<div className="rounded-xl border border-storm-border bg-storm-z1 p-6 text-center">
			<div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-storm-z2">
				<Inbox className="h-4 w-4 text-storm-muted" />
			</div>
			<p className="text-sm font-medium text-white">{title}</p>
			{description ? <p className="mt-1 text-xs text-storm-muted">{description}</p> : null}
		</div>
	);
}

export function ErrorState({ title, description }: StateMessageProps) {
	return (
		<div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-center">
			<div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
				<AlertCircle className="h-4 w-4 text-red-400" />
			</div>
			<p className="text-sm font-medium text-white">{title}</p>
			{description ? <p className="mt-1 text-xs text-red-200">{description}</p> : null}
		</div>
	);
}
