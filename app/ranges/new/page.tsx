import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { RangeForm } from "@/components/range-form";

export const dynamic = "force-dynamic";

export default async function NewRangePage() {
  const settings = await prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
  return (
    <div className="space-y-6">
      <PageHeader title="Add IP range" description="Define a reserved pool with strict IPv4 validation." />
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <RangeForm defaults={{ vlan: settings.defaultVlan, category: settings.defaultCategory }} />
      </div>
    </div>
  );
}
