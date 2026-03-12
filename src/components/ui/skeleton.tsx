import { cn } from "@/utils/cn";

interface SkeletonProps {
	className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
	return <div className={cn("skeleton", className)} />;
}

/* ─── Pre-built skeleton patterns ─── */

export function SkeletonCard() {
	return (
		<div className="storm-card p-5 space-y-4">
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-24" />
				<Skeleton className="h-8 w-8 rounded-lg" />
			</div>
			<Skeleton className="h-8 w-32" />
			<Skeleton className="h-3 w-20" />
		</div>
	);
}

export function SkeletonRow() {
	return (
		<div className="flex items-center gap-4 p-4">
			<Skeleton className="h-10 w-10 rounded-lg" />
			<div className="flex-1 space-y-2">
				<Skeleton className="h-4 w-3/4" />
				<Skeleton className="h-3 w-1/2" />
			</div>
			<Skeleton className="h-6 w-16 rounded-full" />
		</div>
	);
}

export function SkeletonDashboard() {
	return (
		<div className="space-y-6 animate-fade-in">
			{/* Header skeleton */}
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<Skeleton className="h-7 w-56" />
					<Skeleton className="h-4 w-40" />
				</div>
				<div className="flex gap-3">
					<Skeleton className="h-10 w-36 rounded-xl" />
					<Skeleton className="h-10 w-28 rounded-xl" />
				</div>
			</div>
			{/* Stat cards skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
			{/* Content skeleton */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 storm-card">
					<div className="p-4 border-b border-storm-border">
						<Skeleton className="h-5 w-32" />
					</div>
					{Array.from({ length: 4 }).map((_, i) => (
						<SkeletonRow key={i} />
					))}
				</div>
				<div className="storm-card">
					<div className="p-4 border-b border-storm-border">
						<Skeleton className="h-5 w-28" />
					</div>
					{Array.from({ length: 5 }).map((_, i) => (
						<SkeletonRow key={i} />
					))}
				</div>
			</div>
		</div>
	);
}
