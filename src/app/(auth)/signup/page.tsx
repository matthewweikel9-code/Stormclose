import Link from "next/link";
import { signup } from "../actions";

export default function SignupPage({
	searchParams
}: {
	searchParams: { error?: string };
}) {
	return (
		<div>
			<h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
			<p className="mt-2 text-sm text-slate-600">Start using StormClose AI today.</p>

			{searchParams.error ? (
				<p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
					{searchParams.error}
				</p>
			) : null}

			<form action={signup} className="mt-6 space-y-4">
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
					<input
						id="password"
						name="password"
						type="password"
						minLength={6}
						required
						className="input"
					/>
				</div>
				<button type="submit" className="button-primary w-full">
					Sign up
				</button>
			</form>

			<p className="mt-4 text-sm text-slate-600">
				Already have an account?{" "}
				<Link href="/login" className="font-semibold text-brand-700 hover:text-brand-600">
					Log in
				</Link>
			</p>
		</div>
	);
}
