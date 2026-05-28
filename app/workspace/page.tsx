import Link from "next/link";
import { ClipboardList, ExternalLink, ReceiptText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

export default async function WorkspacePage() {
  const [openTasks, activePos, favoriteTools] = await Promise.all([
    prisma.task.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.purchaseNote.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
    prisma.toolLink.count({ where: { active: true, isFavorite: true } }),
  ]);

  const cards = [
    { href: "/tasks", title: "Quick Tasks", helper: `${openTasks} open follow-up${openTasks === 1 ? "" : "s"}`, icon: ClipboardList },
    { href: "/po-tracker", title: "PO Tracker", helper: `${activePos} active purchase note${activePos === 1 ? "" : "s"}`, icon: ReceiptText },
    { href: "/tools", title: "Resources", helper: `${favoriteTools} favorite IT tool${favoriteTools === 1 ? "" : "s"}`, icon: ExternalLink },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="IT Workspace" description="Lightweight follow-ups, purchase notes, and common IT links for warehouse work." />
      <section className="grid gap-3 md:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-950">{card.title}</h2>
                <Icon className="text-slate-500" size={20} />
              </div>
              <p className="mt-3 text-sm text-slate-600">{card.helper}</p>
              <span className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white">Open</span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
