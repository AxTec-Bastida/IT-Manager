import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function SetupAdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, userCount] = await Promise.all([searchParams, prisma.appUser.count()]);
  if (userCount > 0) redirect("/login");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-lg flex-col justify-center">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">First admin setup</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Create the first administrator</h1>
        <p className="mt-2 text-sm text-slate-600">This page is only available while no app users exist. Choose a strong password and do not reuse shared warehouse credentials.</p>
        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <form action="/api/auth/setup-admin" method="post" className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input name="name" autoComplete="name" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input name="email" type="email" autoComplete="email" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username optional</span>
            <input name="username" autoComplete="username" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Password</span>
            <input name="password" type="password" autoComplete="new-password" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
          </label>
          <button type="submit" className="min-h-12 w-full rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white">
            Create admin
          </button>
        </form>
      </div>
    </div>
  );
}
