import Link from "next/link";
import Image from "next/image";
import { BookOpen, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const englishSections = [
  {
    title: "Navigation And Daily Start",
    image: "/manual/user/01-navigation.svg",
    alt: "Navigation overview diagram.",
    summary: "Start from Dashboard, Quick Scan, Inventory, or Workspace. Use the menu for deeper workflows.",
    steps: [
      "Use Dashboard for status, urgent work, and daily shortcuts.",
      "Use Quick Scan when you have a label, asset tag, barcode, serial, employee, stock code, or temporary borrower ID.",
      "Use Workspace for tasks, resources, PO follow-up, reports, offline queue, and conflicts.",
    ],
    links: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/scan", label: "Quick Scan" },
      { href: "/workspace", label: "Workspace" },
    ],
  },
  {
    title: "Quick Scan",
    image: "/manual/user/02-quick-scan.svg",
    alt: "Quick Scan workflow diagram.",
    summary: "Quick Scan is the fastest way to find records and start the right action from a phone.",
    steps: [
      "Open Quick Scan.",
      "Scan with camera, use a keyboard-wedge scanner, or type the code manually.",
      "Review the matched record before acting.",
      "Choose the matching action: open asset, assign, return, loan, RMA, move, add photo, issue stock, or open borrower.",
    ],
    links: [{ href: "/scan", label: "Open Quick Scan" }],
  },
  {
    title: "Inventory And Asset Browsing",
    image: "/manual/user/03-inventory.svg",
    alt: "Inventory category workflow diagram.",
    summary: "Inventory is organized by asset category and workflow so daily browsing does not feel like a spreadsheet.",
    steps: [
      "Open Inventory to choose a category or workflow view.",
      "Use Laptops, Mobile, Printers, Scales, Scanners, Network, Assigned, Loaned, RMA, Needs Review, or Missing Photos.",
      "Search inside the current category first. Use Search All Inventory only when needed.",
      "Open the asset detail page for photos, assignments, loans, RMA, values, labels, and history.",
    ],
    links: [
      { href: "/devices", label: "Inventory Hub" },
      { href: "/inventory/mobile", label: "Mobile Devices" },
      { href: "/inventory/needs-review", label: "Needs Review" },
      { href: "/inventory/missing-photos", label: "Missing Photos" },
    ],
  },
  {
    title: "Inventory Intake And Labels",
    image: "/manual/user/04-intake-labels.svg",
    alt: "Intake and labels workflow diagram.",
    summary: "Use Intake for new items. Serialized assets become Device records; generic consumables become StockItem quantity.",
    steps: [
      "Use Single Asset Intake for one laptop, printer, scale, scanner, mobile device, or other serialized item.",
      "Use Bulk Asset Intake for generated ranges such as J001-J100 or Zebra-208-Zebra-250.",
      "Use Stock Intake for consumables and peripherals tracked by quantity.",
      "Use Labels to generate QR/barcode labels. Labels encode asset tags only by default.",
    ],
    links: [
      { href: "/intake", label: "Intake Hub" },
      { href: "/intake/assets/new", label: "Single Asset Intake" },
      { href: "/intake/assets/bulk", label: "Bulk Asset Intake" },
      { href: "/intake/stock", label: "Stock Intake" },
      { href: "/labels", label: "Labels" },
    ],
  },
  {
    title: "Assignments, Asset Loans, And Stock Issues",
    image: "/manual/user/05-responsibility.svg",
    alt: "Assignment, loan, and stock issue comparison diagram.",
    summary: "Use the right workflow so history stays clean.",
    steps: [
      "Use Assignments for long-term equipment responsibility tied to an employee.",
      "Use Asset Loans for temporary serialized equipment checkout with an expected return date.",
      "Use Stock Issue for generic quantity-based items such as keyboards, cables, toner, adapters, batteries, and headsets.",
      "Use Temporary Borrowers only when the person is not in Employees yet.",
    ],
    links: [
      { href: "/assignments", label: "Assignments" },
      { href: "/loans/quick-checkout", label: "Quick Asset Loan" },
      { href: "/stock/issue", label: "Issue Stock" },
      { href: "/temporary-borrowers", label: "Temporary Borrowers" },
    ],
  },
  {
    title: "RMA, Repair, And Maintenance",
    image: "/manual/user/06-repair-maintenance.svg",
    alt: "Repair and maintenance workflow diagram.",
    summary: "RMA handles batches sent to repair. Maintenance handles service work for printers, scales, and fixed equipment.",
    steps: [
      "Create an RMA case, add devices, send the batch, then receive each item as repaired, replaced, rejected, lost, retired, or returned as-is.",
      "Use Maintenance to record cleaning, service, supplies, and check dates.",
      "Alerts and jobs can remind the team about follow-up and due maintenance.",
      "Printer polling and SNMP are not part of the current workflow.",
    ],
    links: [
      { href: "/rma", label: "RMA" },
      { href: "/maintenance", label: "Maintenance" },
      { href: "/maintenance/printers", label: "Printer Maintenance" },
      { href: "/maintenance/scales", label: "Scale Maintenance" },
    ],
  },
  {
    title: "Photos, Data Quality, And Cleanup",
    image: "/manual/user/07-compliance.svg",
    alt: "Photo compliance and data quality diagram.",
    summary: "Use photo compliance and data quality tools to keep imported and daily records audit-ready.",
    steps: [
      "On asset detail, add overview, asset tag, serial label, condition, damage, and installed-location photos when needed.",
      "Use Missing Photos to focus on photo compliance.",
      "Use Data Quality to review duplicate IPs, suspicious imports, missing fields, stock cleanup, mobile pairings, and other issues.",
      "Do not auto-fix ambiguous data. Open the record, review, then apply only safe actions.",
    ],
    links: [
      { href: "/photos/compliance", label: "Photo Compliance" },
      { href: "/data-quality", label: "Data Quality" },
      { href: "/tasks", label: "Tasks" },
    ],
  },
  {
    title: "Facturas, Line Items, And Asset Value",
    image: "/manual/user/08-facturas-values.svg",
    alt: "Factura and asset value workflow diagram.",
    summary: "Facturas store purchase documents and can help link cost, warranty, and line item details to assets.",
    steps: [
      "Open Facturas to upload, view, or edit purchase records.",
      "Use extraction tools as helpers, then review line items before applying values.",
      "Link assets or stock only when the match is clear.",
      "Use Asset Value on asset detail to track cost, warranty, depreciation, and lifecycle notes.",
    ],
    links: [
      { href: "/facturas", label: "Facturas" },
      { href: "/reports", label: "Reports" },
    ],
  },
  {
    title: "Physical Audits And Offline Queue",
    image: "/manual/user/09-audits-offline.svg",
    alt: "Audit and offline queue workflow diagram.",
    summary: "Physical audits record observations. Offline queue keeps field work moving when connectivity is weak.",
    steps: [
      "Create an audit for a scope or area, scan expected assets, then review found, missing, wrong area, unknown, and duplicate results.",
      "Export audit findings or create tasks from discrepancies.",
      "Use Offline Queue for supported offline scan, move, and photo actions.",
      "Resolve Offline Conflicts manually when records changed, permissions changed, or the phone lost a queued photo file.",
    ],
    links: [
      { href: "/audits", label: "Audits" },
      { href: "/offline", label: "Offline Queue" },
      { href: "/offline/conflicts", label: "Offline Conflicts" },
    ],
  },
  {
    title: "Alerts, Tasks, Jobs, Backups, And Admin Areas",
    image: "/manual/user/10-alerts-admin.svg",
    alt: "Alerts and admin workflow diagram.",
    summary: "Alerts show operational risk. Admin tools control settings, users, backups, jobs, email, and sensitive areas.",
    steps: [
      "Use Alerts to acknowledge, resolve, ignore, or create tasks from operational issues.",
      "Use Tasks for follow-up work and accountability.",
      "Admins use Jobs to refresh reminders and Backups to protect the database and uploads.",
      "Admins manage users, settings, email notification rules, imports, and BitLocker vault access.",
    ],
    links: [
      { href: "/alerts", label: "Alerts" },
      { href: "/tasks", label: "Tasks" },
      { href: "/jobs", label: "Jobs" },
      { href: "/backups", label: "Backups" },
      { href: "/admin", label: "Admin Center" },
    ],
  },
];

const spanishSections = [
  {
    title: "Navegación Y Arranque Diario",
    image: "/manual/user/01-navigation.svg",
    alt: "Diagrama de navegación general.",
    summary: "Empieza desde Inicio, Escaneo, Inventario o Trabajo. Usa el menú para flujos más específicos.",
    steps: [
      "Usa Inicio para ver estado, pendientes urgentes y accesos rápidos.",
      "Usa Escaneo cuando tengas una etiqueta, código, serie, empleado, stock o ID temporal.",
      "Usa Trabajo para tareas, recursos, PO, reportes, cola offline y conflictos.",
    ],
    links: [
      { href: "/dashboard", label: "Inicio" },
      { href: "/scan", label: "Escaneo" },
      { href: "/workspace", label: "Trabajo" },
    ],
  },
  {
    title: "Escaneo Rápido",
    image: "/manual/user/02-quick-scan.svg",
    alt: "Diagrama del flujo de escaneo.",
    summary: "Escaneo es la forma más rápida de encontrar registros y tomar acción desde el teléfono.",
    steps: [
      "Abre Escaneo.",
      "Escanea con cámara, usa lector tipo teclado o escribe el código manualmente.",
      "Revisa el registro encontrado antes de cambiar algo.",
      "Elige la acción correcta: abrir, asignar, devolver, prestar, RMA, mover, agregar foto o entregar stock.",
    ],
    links: [{ href: "/scan", label: "Abrir Escaneo" }],
  },
  {
    title: "Inventario Y Búsqueda De Activos",
    image: "/manual/user/03-inventory.svg",
    alt: "Diagrama de categorías de inventario.",
    summary: "Inventario está organizado por categoría y flujo para evitar listas tipo Excel.",
    steps: [
      "Abre Inventario y elige una categoría o vista de trabajo.",
      "Usa Laptops, Mobile, Impresoras, Básculas, Scanners, Red, Asignados, Prestados, RMA, Revisar o Fotos faltantes.",
      "Busca primero dentro de la categoría actual. Usa búsqueda global solo cuando haga falta.",
      "Abre el detalle del activo para ver fotos, asignaciones, préstamos, RMA, valores, etiquetas e historial.",
    ],
    links: [
      { href: "/devices", label: "Inventario" },
      { href: "/inventory/mobile", label: "Dispositivos móviles" },
      { href: "/inventory/needs-review", label: "Necesita revisión" },
      { href: "/inventory/missing-photos", label: "Fotos faltantes" },
    ],
  },
  {
    title: "Alta De Inventario Y Etiquetas",
    image: "/manual/user/04-intake-labels.svg",
    alt: "Diagrama de alta de inventario y etiquetas.",
    summary: "Usa Intake para artículos nuevos. Los equipos serializados crean activos; consumibles crean stock.",
    steps: [
      "Usa Alta de activo para un equipo serializado individual.",
      "Usa Alta masiva para rangos como J001-J100 o Zebra-208-Zebra-250.",
      "Usa Alta de stock para consumibles o periféricos por cantidad.",
      "Usa Etiquetas para generar QR/barcode. Por defecto solo codifican el asset tag.",
    ],
    links: [
      { href: "/intake", label: "Alta de inventario" },
      { href: "/intake/assets/new", label: "Activo individual" },
      { href: "/intake/assets/bulk", label: "Alta masiva" },
      { href: "/intake/stock", label: "Alta de stock" },
      { href: "/labels", label: "Etiquetas" },
    ],
  },
  {
    title: "Asignaciones, Préstamos Y Stock",
    image: "/manual/user/05-responsibility.svg",
    alt: "Comparación de asignación, préstamo y stock.",
    summary: "Usa el flujo correcto para mantener limpio el historial.",
    steps: [
      "Usa Asignaciones para responsabilidad de equipo a largo plazo con un empleado.",
      "Usa Préstamos para equipo serializado temporal con fecha esperada de retorno.",
      "Usa Stock Issue para artículos genéricos por cantidad como teclados, cables, toner, adaptadores y baterías.",
      "Usa Temporales cuando la persona no esté en Empleados todavía.",
    ],
    links: [
      { href: "/assignments", label: "Asignaciones" },
      { href: "/loans/quick-checkout", label: "Préstamo rápido" },
      { href: "/stock/issue", label: "Entregar stock" },
      { href: "/temporary-borrowers", label: "Temporales" },
    ],
  },
  {
    title: "RMA, Reparación Y Mantenimiento",
    image: "/manual/user/06-repair-maintenance.svg",
    alt: "Diagrama de reparación y mantenimiento.",
    summary: "RMA maneja lotes enviados a reparación. Mantenimiento registra servicio de impresoras, básculas y equipo fijo.",
    steps: [
      "Crea un caso RMA, agrega dispositivos, envía el lote y recibe cada equipo con resultado.",
      "Usa Mantenimiento para limpieza, servicio, supplies y fechas de revisión.",
      "Alertas y jobs ayudan a recordar seguimientos y vencimientos.",
      "El sistema actual no hace polling SNMP de impresoras.",
    ],
    links: [
      { href: "/rma", label: "RMA" },
      { href: "/maintenance", label: "Mantenimiento" },
      { href: "/maintenance/printers", label: "Impresoras" },
      { href: "/maintenance/scales", label: "Básculas" },
    ],
  },
  {
    title: "Fotos, Calidad De Datos Y Limpieza",
    image: "/manual/user/07-compliance.svg",
    alt: "Diagrama de fotos y calidad de datos.",
    summary: "Usa fotos y calidad de datos para mantener registros listos para auditoría.",
    steps: [
      "En detalle del activo, agrega fotos de vista general, etiqueta, serie, condición, daño o ubicación instalada.",
      "Usa Fotos faltantes para enfocarte en cumplimiento fotográfico.",
      "Usa Calidad de datos para duplicados, importaciones sospechosas, campos faltantes, stock, pairings y otros problemas.",
      "No arregles datos ambiguos automáticamente. Abre, revisa y aplica solo acciones seguras.",
    ],
    links: [
      { href: "/photos/compliance", label: "Cumplimiento de fotos" },
      { href: "/data-quality", label: "Calidad de datos" },
      { href: "/tasks", label: "Tareas" },
    ],
  },
  {
    title: "Facturas, Partidas Y Valor Del Activo",
    image: "/manual/user/08-facturas-values.svg",
    alt: "Diagrama de facturas y valor de activo.",
    summary: "Facturas guardan documentos de compra y ayudan a ligar costo, garantía y partidas a activos.",
    steps: [
      "Abre Facturas para subir, ver o editar registros de compra.",
      "Usa extracción como ayuda, pero revisa partidas antes de aplicar valores.",
      "Liga activos o stock solo cuando el match sea claro.",
      "Usa Valor del activo para costo, garantía, depreciación y notas de ciclo de vida.",
    ],
    links: [
      { href: "/facturas", label: "Facturas" },
      { href: "/reports", label: "Reportes" },
    ],
  },
  {
    title: "Auditorías Físicas Y Cola Offline",
    image: "/manual/user/09-audits-offline.svg",
    alt: "Diagrama de auditoría y cola offline.",
    summary: "Auditorías registran observaciones. Offline permite seguir trabajando con mala conexión.",
    steps: [
      "Crea auditoría por área o alcance, escanea activos esperados y revisa resultados.",
      "Exporta hallazgos o crea tareas desde discrepancias.",
      "Usa Offline Queue para acciones soportadas como escaneo, movimiento y fotos.",
      "Resuelve conflictos manualmente cuando cambió el registro, permisos o el teléfono perdió una foto pendiente.",
    ],
    links: [
      { href: "/audits", label: "Auditorías" },
      { href: "/offline", label: "Cola offline" },
      { href: "/offline/conflicts", label: "Conflictos offline" },
    ],
  },
  {
    title: "Alertas, Tareas, Jobs, Respaldos Y Admin",
    image: "/manual/user/10-alerts-admin.svg",
    alt: "Diagrama de alertas y administración.",
    summary: "Alertas muestran riesgo operativo. Admin controla settings, usuarios, backups, jobs, email y áreas sensibles.",
    steps: [
      "Usa Alertas para reconocer, resolver, ignorar o crear tareas desde problemas operativos.",
      "Usa Tareas para seguimiento y responsabilidad.",
      "Admins usan Jobs para refrescar recordatorios y Respaldos para proteger la base de datos y uploads.",
      "Admins manejan usuarios, settings, emails, imports y acceso a BitLocker vault.",
    ],
    links: [
      { href: "/alerts", label: "Alertas" },
      { href: "/tasks", label: "Tareas" },
      { href: "/jobs", label: "Jobs" },
      { href: "/backups", label: "Respaldos" },
      { href: "/admin", label: "Admin" },
    ],
  },
];

const manualText = {
  en: {
    title: "Warehouse IT User Manual",
    description: "Phone-first guide for daily inventory, scan, assignment, loan, stock, RMA, audit, photo, factura, and alert workflows.",
    resources: "Resources",
    startTitle: "Start With The Right Tool",
    startBody: "This app is the source of truth for warehouse IT inventory. Use scans and guided workflows whenever possible. Do not store passwords, BitLocker recovery keys, SMTP credentials, or private notes in general records, labels, tasks, or resources.",
    pills: ["Scan first", "Review before changing", "Use photos for proof", "Back up before risky work"],
    section: "Section",
    openTools: "Open related tools",
    handoffTitle: "Important Handoff Notes",
    handoffBody: "The app preserves history. Prefer return, archive, close, or deactivate actions over deleting records. Backups must include the database and uploads folders. Admin-only features should be used by trained users because they can affect email, jobs, imports, settings, and sensitive vault access.",
    languageNote: "Manual language",
    stewardshipTitle: "Project Stewardship",
    stewardshipBody: "Built and handed off by Alejandro Bastida / AxTec Bastida for Warehouse IT operations.",
    repository: "GitHub repository",
  },
  es: {
    title: "Manual De Usuario Warehouse IT",
    description: "Guía phone-first para inventario, escaneo, asignaciones, préstamos, stock, RMA, auditorías, fotos, facturas y alertas.",
    resources: "Recursos",
    startTitle: "Empieza Con La Herramienta Correcta",
    startBody: "Esta app es la fuente de verdad para inventario IT de almacén. Usa escaneos y flujos guiados cuando sea posible. No guardes contraseñas, llaves BitLocker, credenciales SMTP ni notas privadas en registros normales, etiquetas, tareas o recursos.",
    pills: ["Escanea primero", "Revisa antes de cambiar", "Usa fotos como evidencia", "Haz backup antes de riesgo"],
    section: "Sección",
    openTools: "Abrir herramientas",
    handoffTitle: "Notas Importantes De Entrega",
    handoffBody: "La app preserva historial. Prefiere devolver, archivar, cerrar o desactivar antes de borrar registros. Los respaldos deben incluir la base de datos y carpetas de uploads. Las funciones de admin deben usarlas personas capacitadas porque afectan email, jobs, imports, settings y áreas sensibles.",
    languageNote: "Idioma del manual",
    stewardshipTitle: "Responsable Del Proyecto",
    stewardshipBody: "Construido y entregado por Alejandro Bastida / AxTec Bastida para operaciones de Warehouse IT.",
    repository: "Repositorio GitHub",
  },
};

export default async function UserManualPage({ searchParams }: Props) {
  const params = await searchParams;
  const locale = normalizeLocale(typeof params.lang === "string" ? params.lang : null);
  const text = manualText[locale];
  const sections = locale === "es" ? spanishSections : englishSections;
  return (
    <div className="space-y-6">
      <PageHeader
        title={text.title}
        description={text.description}
        action={<Link href="/tools" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><BookOpen size={16} />{text.resources}</Link>}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <span className="text-sm font-semibold text-slate-700">{text.languageNote}</span>
        <Link href="/manual/user?lang=en" className={`rounded-md px-3 py-2 text-sm font-semibold ${locale === "en" ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>English</Link>
        <Link href="/manual/user?lang=es" className={`rounded-md px-3 py-2 text-sm font-semibold ${locale === "es" ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"}`}>Español</Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">{text.startTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{text.startBody}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {text.pills.map((pill) => <ManualPill key={pill} label={pill} />)}
        </div>
      </section>

      <div className="space-y-5">
        {sections.map((section, index) => (
          <section key={section.title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{text.section} {index + 1}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">{section.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{section.summary}</p>
            </div>
            <Image src={section.image} alt={section.alt} width={1200} height={520} className="h-auto w-full border-b border-slate-100 bg-slate-50" />
            <div className="grid gap-4 p-4 lg:grid-cols-[1fr_280px]">
              <ol className="space-y-2 text-sm leading-6 text-slate-700">
                {section.steps.map((step) => <li key={step} className="rounded-lg bg-slate-50 px-3 py-2">{step}</li>)}
              </ol>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-950">{text.openTools}</p>
                {section.links.map((link) => (
                  <Link key={link.href} href={link.href} className="flex min-h-11 items-center justify-between rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    {link.label}
                    <ExternalLink size={14} />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <h2 className="font-semibold">{text.handoffTitle}</h2>
        <p className="mt-2">{text.handoffBody}</p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-950">{text.stewardshipTitle}</h2>
            <p className="mt-1">{text.stewardshipBody}</p>
          </div>
          <a href="https://github.com/AxTec-Bastida/IT-Manager" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
            <ExternalLink size={16} /> {text.repository}
          </a>
        </div>
      </section>
    </div>
  );
}

function ManualPill({ label }: { label: string }) {
  return <span className="rounded-full bg-slate-100 px-3 py-2 text-center text-sm font-semibold text-slate-700">{label}</span>;
}
