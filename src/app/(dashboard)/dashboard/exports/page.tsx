import { PhasePlaceholder } from "@/components/dashboard/PhasePlaceholder";

export default function ExportsPage() {
	return (
		<PhasePlaceholder
			title="Exports"
			phase={3}
			description="JobNimbus export queue, retry handling, and handoff summaries will be available on this screen."
		/>
	);
}
