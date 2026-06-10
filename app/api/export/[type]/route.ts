import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { parseList } from "@/lib/conflicts";
import { handleApiError, jsonError } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { assetFacturaExportFields } from "@/lib/facturas";

type Context = { params: Promise<{ type: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await requirePermission("inventory.read");
    const { type } = await context.params;
    let rows: Record<string, unknown>[] = [];

  if (type === "devices") {
    const devices = await prisma.device.findMany({ orderBy: { name: "asc" }, include: { factura: true, photos: true } });
    rows = devices.map((device) => ({ ...device, ...assetFacturaExportFields(device) }));
  } else if (type === "ranges") {
    rows = await prisma.ipRange.findMany({ orderBy: { name: "asc" } });
  } else if (type === "conflicts") {
    const conflicts = await prisma.conflict.findMany({ where: { resolved: false }, orderBy: { createdAt: "desc" } });
    rows = conflicts.map((conflict) => ({
      ...conflict,
      affectedDeviceIds: parseList(conflict.affectedDeviceIds).join("|"),
      affectedIps: parseList(conflict.affectedIps).join("|"),
    }));
  } else if (type === "scan-results") {
    rows = await prisma.scanResult.findMany({ orderBy: { seenAt: "desc" }, take: 1000 });
  } else if (type === "stock-items") {
    const stockItems = await prisma.stockItem.findMany({ orderBy: { name: "asc" }, include: { factura: true } });
    rows = stockItems.map((item) => ({
      ...item,
      facturaNumber: item.factura?.facturaNumber ?? "",
      facturaVendor: item.factura?.vendorName ?? "",
      facturaPurchaseDate: item.factura?.purchaseDate?.toISOString().slice(0, 10) ?? "",
    }));
  } else if (type === "stock-movements") {
    const movements = await prisma.stockMovement.findMany({ orderBy: { createdAt: "desc" }, take: 2000, include: { factura: true } });
    rows = movements.map((movement) => ({ ...movement, facturaNumber: movement.factura?.facturaNumber ?? "", facturaVendor: movement.factura?.vendorName ?? "" }));
  } else if (type === "facturas") {
    rows = await prisma.factura.findMany({ orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }] });
  } else if (type === "maintenance-records") {
    rows = await prisma.maintenanceRecord.findMany({ orderBy: { performedAt: "desc" }, take: 2000 });
  } else if (type === "tasks") {
    const tasks = await prisma.task.findMany({ orderBy: [{ status: "asc" }, { dueDate: "asc" }, { updatedAt: "desc" }], include: { relatedDevice: true, relatedStockItem: true, relatedFactura: true } });
    rows = tasks.map((task) => ({
      ...task,
      relatedDevice: task.relatedDevice?.name ?? "",
      relatedStockItem: task.relatedStockItem?.name ?? "",
      relatedFactura: task.relatedFactura?.facturaNumber ?? "",
    }));
  } else if (type === "po-tracker") {
    const notes = await prisma.purchaseNote.findMany({ orderBy: [{ status: "asc" }, { followUpDate: "asc" }, { updatedAt: "desc" }], include: { relatedFactura: true } });
    rows = notes.map((note) => ({ ...note, relatedFactura: note.relatedFactura?.facturaNumber ?? "" }));
  } else if (type === "tool-links") {
    rows = await prisma.toolLink.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  } else if (type === "rma-cases") {
    const cases = await prisma.rmaCase.findMany({ orderBy: [{ status: "asc" }, { sentAt: "desc" }], include: { items: true } });
    rows = cases.map((rma) => ({
      rmaNumber: rma.rmaNumber,
      title: rma.title,
      status: rma.status,
      destination: rma.destination,
      vendorName: rma.vendorName,
      carrier: rma.carrier,
      trackingNumber: rma.trackingNumber,
      sentAt: rma.sentAt?.toISOString().slice(0, 10) ?? "",
      expectedFollowUpAt: rma.expectedFollowUpAt?.toISOString().slice(0, 10) ?? "",
      itemCount: rma.items.length,
      pendingCount: rma.items.filter((item) => item.result === "PENDING").length,
      notes: rma.notes,
    }));
  } else if (type === "rma-items") {
    const items = await prisma.rmaItem.findMany({ orderBy: [{ createdAt: "desc" }], include: { rmaCase: true, device: true, replacementDevice: true } });
    rows = items.map((item) => ({
      rmaNumber: item.rmaCase.rmaNumber,
      rmaStatus: item.rmaCase.status,
      destination: item.rmaCase.destination,
      vendorName: item.rmaCase.vendorName,
      sentAt: item.sentAt?.toISOString().slice(0, 10) ?? item.rmaCase.sentAt?.toISOString().slice(0, 10) ?? "",
      expectedFollowUpAt: item.rmaCase.expectedFollowUpAt?.toISOString().slice(0, 10) ?? "",
      assetTag: item.device.assetTag,
      serialNumber: item.device.serialNumber,
      model: item.device.model,
      category: item.device.category,
      result: item.result,
      returnedAt: item.returnedAt?.toISOString().slice(0, 10) ?? "",
      replacementAssetTag: item.replacementDevice?.assetTag ?? "",
      notes: item.notes,
    }));
  } else if (type === "stock-issues") {
    const issues = await prisma.stockIssue.findMany({ orderBy: [{ status: "asc" }, { issuedAt: "desc" }], include: { stockItem: true, employee: true, temporaryBorrower: true } });
    rows = issues.map((issue) => ({
      issueNumber: issue.issueNumber,
      issueType: issue.issueType,
      status: issue.status,
      stockItem: issue.stockItem.name,
      sku: issue.stockItem.sku,
      barcodeValue: issue.stockItem.barcodeValue,
      quantity: issue.quantity,
      returnedQuantity: issue.returnedQuantity,
      employee: issue.employee?.fullName ?? "",
      employeeId: issue.employee?.employeeId ?? "",
      temporaryBorrower: issue.temporaryBorrower?.name ?? "",
      tempId: issue.temporaryBorrower?.tempId ?? "",
      issuedAt: issue.issuedAt.toISOString().slice(0, 10),
      expectedReturnAt: issue.expectedReturnAt?.toISOString().slice(0, 10) ?? "",
      returnedAt: issue.returnedAt?.toISOString().slice(0, 10) ?? "",
      conditionOut: issue.conditionOut,
      conditionIn: issue.conditionIn,
      notes: issue.notes,
      returnNotes: issue.returnNotes,
    }));
  } else if (type === "asset-loans") {
    const loans = await prisma.assetLoan.findMany({ orderBy: [{ status: "asc" }, { loanStartAt: "desc" }], include: { employee: true, temporaryBorrower: true, items: true } });
    rows = loans.map((loan) => ({
      loanNumber: loan.loanNumber,
      status: loan.status,
      employee: loan.employee?.fullName ?? "",
      employeeId: loan.employee?.employeeId ?? "",
      temporaryBorrower: loan.temporaryBorrower?.name ?? "",
      tempId: loan.temporaryBorrower?.tempId ?? "",
      loanedBy: loan.loanedBy,
      loanStartAt: loan.loanStartAt.toISOString().slice(0, 10),
      expectedReturnAt: loan.expectedReturnAt.toISOString().slice(0, 10),
      actualReturnAt: loan.actualReturnAt?.toISOString().slice(0, 10) ?? "",
      itemCount: loan.items.length,
      pendingCount: loan.items.filter((item) => item.returnStatus === "PENDING").length,
      termsAccepted: loan.termsAccepted,
      checkoutNotes: loan.checkoutNotes,
      returnNotes: loan.returnNotes,
    }));
  } else if (type === "asset-loan-items") {
    const items = await prisma.assetLoanItem.findMany({ orderBy: [{ createdAt: "desc" }], include: { loan: { include: { employee: true, temporaryBorrower: true } }, device: true } });
    rows = items.map((item) => ({
      loanNumber: item.loan.loanNumber,
      loanStatus: item.loan.status,
      borrower: item.loan.employee?.fullName ?? item.loan.temporaryBorrower?.name ?? "",
      loanStartAt: item.loan.loanStartAt.toISOString().slice(0, 10),
      expectedReturnAt: item.loan.expectedReturnAt.toISOString().slice(0, 10),
      assetTag: item.device.assetTag,
      serialNumber: item.device.serialNumber,
      model: item.device.model,
      category: item.device.category,
      returnStatus: item.returnStatus,
      conditionOut: item.conditionOut,
      conditionIn: item.conditionIn,
      accessoriesOut: item.accessoriesOut,
      accessoriesReturned: item.accessoriesReturned,
      returnedAt: item.returnedAt?.toISOString().slice(0, 10) ?? "",
      returnNotes: item.returnNotes,
    }));
  } else if (type === "temporary-borrowers") {
    const borrowers = await prisma.temporaryBorrower.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { stockIssues: true } });
    rows = borrowers.map((borrower) => ({
      tempId: borrower.tempId,
      name: borrower.name,
      department: borrower.department,
      area: borrower.area,
      supervisorName: borrower.supervisorName,
      phone: borrower.phone,
      email: borrower.email,
      reason: borrower.reason,
      active: borrower.active,
      activeIssues: borrower.stockIssues.filter((issue) => ["ACTIVE", "PARTIALLY_RETURNED"].includes(issue.status)).length,
      notes: borrower.notes,
      createdAt: borrower.createdAt.toISOString(),
    }));
  } else {
    return jsonError("Export type must be devices, ranges, conflicts, scan-results, stock-items, stock-movements, maintenance-records, facturas, tasks, po-tracker, tool-links, rma-cases, rma-items, stock-issues, asset-loans, asset-loan-items, or temporary-borrowers.", 400);
  }

    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${type}.csv"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
