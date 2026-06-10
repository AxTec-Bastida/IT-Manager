import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export function ForbiddenPanel({ title = "Access denied", message = "Your role does not have permission to use this part of the app." }: { title?: string; message?: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-2 py-10">
      <section className="w-full rounded-lg border border-amber-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-3 text-amber-800">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">
            Back to dashboard
          </Link>
          <Link href="/scan" className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            Open scan
          </Link>
        </div>
      </section>
    </div>
  );
}
