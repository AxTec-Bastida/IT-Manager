import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { hasPageRole } from "@/lib/page-permissions";
import { MasterDataManager } from "@/components/master-data-manager";
import { ActionLink, PageActions } from "@/components/ui-patterns";

export const dynamic = "force-dynamic";

export default async function AdminMasterDataPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="Master Data management is admin-only." />;

  // Seed check
  const count = await prisma.controlledValue.count();
  if (count === 0) {
    const defaults = [
      // Asset categories
      ...["Laptop", "Desktop", "Printer", "MFP", "Scanner", "Scale", "Sled", "iPod", "iPhone", "Tablet", "Access Point", "Network", "Peripheral", "Other"].map(name => ({ type: "ASSET_CATEGORY", name, normalizedName: name.toUpperCase() })),
      // Departments / Areas
      ...["IT", "Ops", "HR", "AT", "Co-Production", "Packing", "Receiving", "Returns", "Shipping", "Office"].map(name => ({ type: "DEPARTMENT", name, normalizedName: name.toUpperCase() })),
      // Task categories
      ...["Maintenance", "Inventory", "RMA", "Stock", "Setup", "Access", "Repair", "Audit", "Other"].map(name => ({ type: "TASK_CATEGORY", name, normalizedName: name.toUpperCase() })),
      // Stock categories
      ...["Charger", "Cable", "Keyboard", "Mouse", "Headset", "Toner", "Ink", "Printhead", "Roller", "Label", "Accessory", "Other"].map(name => ({ type: "STOCK_CATEGORY", name, normalizedName: name.toUpperCase() })),
      // Printer consumable types
      ...["Toner", "Ink", "Drum", "Roller", "Printhead", "Maintenance Kit", "Label Roll", "Ribbon", "Other"].map(name => ({ type: "PRINTER_CONSUMABLE_TYPE", name, normalizedName: name.toUpperCase() })),
    ];
    await prisma.controlledValue.createMany({ data: defaults });
  }

  // Get initial values for the default selected type (ASSET_CATEGORY)
  const initialValues = await prisma.controlledValue.findMany({
    where: { type: "ASSET_CATEGORY" },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Master Data & Taxonomy"
        description="Configure categories, brands, departments, areas, and other controlled lists used across forms."
        action={
          <PageActions>
            <ActionLink href="/admin" variant="secondary">Admin Center</ActionLink>
          </PageActions>
        }
      />

      <MasterDataManager initialValues={initialValues.map(v => ({
        id: v.id,
        type: v.type,
        name: v.name,
        description: v.description,
        isActive: v.isActive,
      }))} />
    </div>
  );
}
