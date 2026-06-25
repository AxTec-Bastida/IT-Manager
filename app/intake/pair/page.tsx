import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { IntakePairForm } from "@/components/intake-pair-form";
import { hasPagePermission } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

export default async function PairCompanionDevicesPage() {
  if (!(await hasPagePermission("inventory.write"))) return <ForbiddenPanel message="Pairing devices requires IT Staff or Admin access." />;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pair Companion Devices"
        description="Link two existing devices together, such as a sled with an iPod or iPhone. Both devices must already exist in inventory before pairing."
        action={
          <Link href="/intake" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ArrowLeft size={16} />
            Intake hub
          </Link>
        }
      />
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold">How pairing works</p>
        <ul className="mt-2 list-disc pl-4 space-y-1">
          <li>Search or scan for the first device (iPod or iPhone).</li>
          <li>Search or scan for the second device (sled).</li>
          <li>Preview the relationship and confirm.</li>
          <li>If either device is already paired, you will see a warning before confirming.</li>
        </ul>
      </div>
      <IntakePairForm />
    </div>
  );
}
