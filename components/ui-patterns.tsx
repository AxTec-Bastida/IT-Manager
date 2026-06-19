import Link from "next/link";
import { clsx } from "clsx";

export function SectionCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>{children}</section>;
}

export function MobileCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <article className={clsx("rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/70", className)}>{children}</article>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm shadow-slate-200/60">
      <p className="font-semibold text-slate-950">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end", className)}>{children}</div>;
}

export function ActionLink({
  href,
  children,
  variant = "secondary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
        variant === "primary"
          ? "bg-slate-950 text-white hover:bg-slate-800"
          : variant === "danger"
            ? "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function BottomActionBar({ children }: { children: React.ReactNode }) {
  return (
    <nav className="fixed inset-x-3 bottom-24 z-30 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur lg:hidden">
      {children}
    </nav>
  );
}
