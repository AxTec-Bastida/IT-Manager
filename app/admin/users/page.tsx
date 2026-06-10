import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";

const roles = ["ADMIN", "IT_STAFF", "VIEWER", "AUDITOR"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="User management is admin-only." />;
  const [{ error, ok }, users, currentUser] = await Promise.all([
    searchParams,
    prisma.appUser.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    getCurrentUser(),
  ]);
  if (!currentUser) redirect("/login");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Admin</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Users and roles</h1>
        <p className="mt-2 text-sm text-slate-600">Manage local app users. Keep admin accounts limited, and deactivate accounts instead of deleting audit history.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <a href="/settings" className="inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 font-semibold text-slate-700">Settings</a>
          <a href="/activity" className="inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 font-semibold text-slate-700">Activity</a>
          <a href="/logout" className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-4 font-semibold text-white">Sign out</a>
        </div>
        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {ok ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{ok}</div> : null}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Create user</h2>
        <form action="/api/admin/users" method="post" className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Name</span>
            <input name="name" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input name="email" type="email" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Username optional</span>
            <input name="username" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Role</span>
            <select name="role" defaultValue="VIEWER" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3">
              {roles.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Temporary password</span>
            <input name="password" type="password" autoComplete="new-password" required className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3" />
          </label>
          <button type="submit" className="min-h-12 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white md:col-span-2">Create user</button>
        </form>
      </section>

      <section className="grid gap-3">
        {users.map((user) => (
          <article key={user.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-950">{user.name}</h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{user.role}</span>
                  <span className={user.isActive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800" : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700"}>
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{user.email}{user.username ? ` · ${user.username}` : ""}</p>
                <p className="mt-1 text-xs text-slate-500">Last login: {user.lastLoginAt ? user.lastLoginAt.toLocaleString() : "Never"}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[30rem]">
                <form action={`/api/admin/users/${user.id}`} method="post" className="flex gap-2">
                  <input type="hidden" name="action" value="role" />
                  <select name="role" defaultValue={user.role} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-2 text-sm">
                    {roles.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <button className="min-h-11 rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700">Save</button>
                </form>
                <form action={`/api/admin/users/${user.id}`} method="post">
                  <input type="hidden" name="action" value={user.isActive ? "deactivate" : "activate"} />
                  <button disabled={user.id === currentUser.id} className="min-h-11 w-full rounded-lg bg-slate-100 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50">
                    {user.isActive ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={`/api/admin/users/${user.id}`} method="post" className="sm:col-span-2">
                  <input type="hidden" name="action" value="reset-password" />
                  <div className="flex gap-2">
                    <input name="password" type="password" placeholder="New password" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
                    <button className="min-h-11 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white">Reset</button>
                  </div>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
