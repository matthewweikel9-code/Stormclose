import Link from "next/link";
import { login } from "../actions";

export default function LoginPage({
	searchParams
}: {
	searchParams: { error?: string; message?: string; next?: string };
}) {
	return (
		<div>
			<h1 className="text-2xl font-bold text-slate-900">Log in</h1>
			<p className="mt-2 text-sm text-slate-600">Welcome back to StormClose AI.</p>

			{searchParams.error ? (
				<p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{searchParams.error}
				</p>
			) : null}

			{searchParams.message ? (
				<p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
					{searchParams.message}
				</p>
			) : null}

			<form action={login} className="mt-6 space-y-4">
				<input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
				<div>
					<label htmlFor="email" className="text-sm font-medium text-slate-700">
						Email
					</label>
					<input id="email" name="email" type="email" required className="input" />
				</div>
				<div>
					<label htmlFor="password" className="text-sm font-medium text-slate-700">
						Password
					</label>
					<input id="password" name="password" type="password" required className="input" />
				</div>
				<div className="text-right">
					<Link
						href="/forgot-password"
						className="text-sm font-medium text-brand-700 hover:text-brand-600"
					>
						Forgot password?
					</Link>
				</div>
				<button type="submit" className="button-primary w-full">
					Log in
				</button>
			</form>

			<p className="mt-4 text-sm text-slate-600">
				No account yet?{" "}
				<Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-600">
					Sign up
				</Link>
			</p>
		</div>
	);
}
