import Link from "next/link";
import { forgotPassword } from "../actions";

export default function ForgotPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
      <p className="mt-2 text-sm text-slate-600">
        Enter your email and we will send a password reset link.
      </p>

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

      <form action={forgotPassword} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
        <button type="submit" className="button-primary w-full">
          Send reset link
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-600">
        Back to{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-600">
          Log in
        </Link>
      </p>
    </div>
  );
}
