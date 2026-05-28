import Link from "next/link";
import { ExternalLink, Plus, Search, SlidersHorizontal } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/badge";
import { toolLinkCategoryLabels, toolLinkCategoryOptions } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ToolsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const showInactive = params.showInactive === "true";

  const toolLinks = await prisma.toolLink.findMany({
    where: {
      ...(showInactive ? {} : { active: true }),
      ...(category ? { category: category as never } : {}),
      ...(q ? { OR: [{ name: { contains: q } }, { url: { contains: q } }, { description: { contains: q } }, { notes: { contains: q } }] } : {}),
    },
    orderBy: [{ isFavorite: "desc" }, { category: "asc" }, { name: "asc" }],
  });
  const favorites = toolLinks.filter((link) => link.active && link.isFavorite);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resources"
        description="Quick links to IT portals, SOPs, vendor pages, and dashboards. Links only, no integrations."
        action={<Link href="/tools/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Plus size={16} />New link</Link>}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Store links only. Do not store passwords, tokens, API keys, or secrets in resource notes.
      </div>

      <form className="sticky top-[73px] z-20 space-y-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:static lg:p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="relative">
            <Search className="absolute left-3 top-4 text-slate-400" size={18} />
            <input name="q" defaultValue={q} className="min-h-14 w-full rounded-md border border-slate-300 pl-10 pr-3 text-base sm:min-h-12" placeholder="Search tools, links, categories" />
          </label>
          <button className="min-h-14 rounded-md bg-slate-950 px-4 font-semibold text-white sm:min-h-12">Search</button>
        </div>
        <details className="rounded-md border border-slate-200 bg-slate-50">
          <summary className="flex min-h-12 items-center justify-between px-3 text-sm font-semibold text-slate-700">
            <span className="inline-flex items-center gap-2"><SlidersHorizontal size={16} />Filters</span>
            <span className="text-xs text-slate-500">{category || showInactive ? "Active" : "Optional"}</span>
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3 md:grid-cols-2">
            <select name="category" defaultValue={category} className="min-h-12 rounded-md border border-slate-300 bg-white px-3 text-base"><option value="">All categories</option>{toolLinkCategoryOptions.map((option) => <option key={option} value={option}>{toolLinkCategoryLabels[option]}</option>)}</select>
            <label className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><input name="showInactive" value="true" type="checkbox" defaultChecked={showInactive} />Show inactive</label>
            <button className="min-h-12 rounded-md bg-slate-950 px-4 font-semibold text-white md:col-span-2">Apply filters</button>
          </div>
        </details>
      </form>

      {favorites.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Favorites</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {favorites.map((link) => <ToolCard key={link.id} link={link} />)}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {toolLinks.filter((link) => !link.isFavorite).map((link) => <ToolCard key={link.id} link={link} />)}
      </section>

      {toolLinks.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">No resource links match this view.</p> : null}
    </div>
  );
}

function ToolCard({ link }: { link: Awaited<ReturnType<typeof prisma.toolLink.findMany>>[number] }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">{link.name}</h2>
          <p className="mt-1 text-sm text-slate-500">{toolLinkCategoryLabels[link.category]}</p>
        </div>
        {!link.active ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Inactive</Badge> : null}
      </div>
      {link.description ? <p className="mt-3 text-sm text-slate-600">{link.description}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {link.isFavorite ? <Badge className="bg-amber-100 text-amber-900 ring-amber-200">Favorite</Badge> : null}
        {link.requiresVpn ? <Badge className="bg-blue-100 text-blue-800 ring-blue-200">VPN Required</Badge> : null}
        {link.internalOnly ? <Badge className="bg-slate-100 text-slate-700 ring-slate-200">Internal Only</Badge> : null}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"><ExternalLink size={16} />Open</a>
        <Link href={`/tools/${link.id}/edit`} className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Edit</Link>
      </div>
    </article>
  );
}
