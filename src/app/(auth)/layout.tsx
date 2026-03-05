export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-[70vh] items-center justify-center">
			<div className="auth-card">{children}</div>
		</div>
	);
}
