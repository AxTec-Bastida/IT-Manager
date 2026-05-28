import { clsx } from "clsx";

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset", className)}>
      {children}
    </span>
  );
}
