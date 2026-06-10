import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/nav";
import { getCurrentUser, sanitizeRedirectPath } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Warehouse IT Inventory",
  title: "Warehouse IT Inventory",
  description: "Phone-first warehouse IT inventory tracking with scanning, assignments, stock, alerts, and location history.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Warehouse IT",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/warehouse-it-icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/warehouse-it-icon.svg", type: "image/svg+xml" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f172a",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <LayoutShell>{children}</LayoutShell>;
}

async function LayoutShell({ children }: { children: React.ReactNode }) {
  const headerStore = await headers();
  const pathname = headerStore.get("x-auth-pathname") ?? "";
  const isPublicPage = pathname === "/login" || pathname === "/setup-admin" || pathname === "/logout";
  const [settings, currentUser, userCount] = await Promise.all([
    prisma.appSettings.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } }).catch(() => ({ siteName: "Warehouse IT Inventory" })),
    getCurrentUser().catch(() => null),
    prisma.appUser.count().catch(() => 0),
  ]);

  if (!isPublicPage && !currentUser) {
    if (userCount === 0) redirect("/setup-admin");
    const next = sanitizeRedirectPath(pathname || "/dashboard");
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-950">
        <div className="min-h-screen lg:flex">
          <AppNav siteName={settings.siteName} user={currentUser ? { name: currentUser.name, role: currentUser.role } : null} />
          <main className="w-full min-w-0 px-4 pb-32 pt-5 sm:px-6 sm:pb-32 sm:pt-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
