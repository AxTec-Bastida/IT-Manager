import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, sanitizeRedirectPath } from "@/lib/auth";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const [{ next, error }, userCount, currentUser] = await Promise.all([searchParams, prisma.appUser.count(), getCurrentUser()]);
  if (currentUser) redirect("/dashboard");
  const nextPath = sanitizeRedirectPath(next);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-md flex-col justify-center">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Warehouse IT Inventory</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use your local app account to access inventory, workflows, labels, audits, and admin tools.</p>
        {userCount === 0 ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            No app users exist yet. Create the first administrator before daily use.
            <Link href="/setup-admin" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-amber-700 px-4 font-semibold text-white">
              Create first admin
            </Link>
          </div>
        ) : null}
        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <form action="/api/auth/login" method="post" className="mt-5 space-y-4">
          <input type="hidden" name="next" value={nextPath} />
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email or username</span>
            <input name="identifier" autoComplete="username" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input name="password" type="password" autoComplete="current-password" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <button type="submit" className="min-h-12 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
