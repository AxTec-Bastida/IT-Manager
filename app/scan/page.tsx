import { PageHeader } from "@/components/page-header";
import { QuickScanPanel } from "@/components/quick-scan-panel";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Camera scan"
        description="Scan QR codes, barcodes, serial labels, MAC labels, IP labels, or internal tags to find and update devices quickly."
      />
      <QuickScanPanel />
    </div>
  );
}
