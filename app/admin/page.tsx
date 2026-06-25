import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { Users, Database, Network, Mail, Sliders, Settings, Shield, Palette } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminCenterPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Admin Center is admin-only." />;

  const sections = [
    {
      title: "Users & Roles",
      href: "/admin/users",
      icon: Users,
      description: "Manage app users, roles, and access.",
    },
    {
      title: "Master Data",
      href: "/admin/master-data",
      icon: Database,
      description: "Manage categories, models, brands, areas, departments, locations, tags, task categories, stock categories, and other controlled lists.",
    },
    {
      title: "Network / IP Ranges",
      href: "/admin/ip-ranges",
      icon: Network,
      description: "Manage IP ranges, VLANs, and network defaults used by IPAM and static equipment.",
    },
    {
      title: "Email & Notifications",
      href: "/admin/email-notifications",
      icon: Mail,
      description: "Review SMTP status and configure notification rules/recipients. SMTP secrets stay in environment variables.",
    },
    {
      title: "Inventory Defaults",
      href: "/admin/inventory-defaults",
      icon: Sliders,
      description: "Configure asset prefixes, default statuses, laptop charger defaults, photo requirements, and label requirements.",
    },
    {
      title: "Stock & Maintenance Defaults",
      href: "/admin/stock-maintenance-defaults",
      icon: Settings,
      description: "Configure stock categories, stock movement reasons, low-stock thresholds, maintenance profiles, and printer consumable types.",
    },
    {
      title: "System Operations",
      href: "/settings",
      icon: Shield,
      description: "General system settings, backups, jobs, health checks, and operational tools.",
    },
    {
      title: "UI Preview Lab",
      href: "/admin/ui-preview",
      icon: Palette,
      description: "View design system and safe UI examples.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Admin Center"
        description="Configure defaults, network subnets, taxonomies, and notifications for the warehouse system."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <Link
              key={sec.title}
              href={sec.href}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-slate-900 p-2.5 text-white">
                  <Icon size={20} />
                </div>
                <h2 className="font-bold text-slate-950">{sec.title}</h2>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">{sec.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
