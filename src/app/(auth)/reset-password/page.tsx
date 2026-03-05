import Link from "next/link";
import { updatePassword } from "../actions";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
      <p className="mt-2 text-sm text-slate-600">Choose a new secure password for your account.</p>

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

      <form action={updatePassword} className="mt-6 space-y-4">
        <div>
          <label htmlFor="password" className="text-sm font-medium text-slate-700">
            New password
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
          Update password
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
