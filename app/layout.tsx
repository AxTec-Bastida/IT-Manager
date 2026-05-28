import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppNav } from "@/components/nav";
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
  title: "Warehouse IT Inventory",
  description: "Warehouse IT inventory tracking with IPAM and read-only UniFi visibility",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <LayoutShell>{children}</LayoutShell>;
}

async function LayoutShell({ children }: { children: React.ReactNode }) {
  const settings = await prisma.appSettings
    .upsert({ where: { id: "default" }, update: {}, create: { id: "default" } })
    .catch(() => ({ siteName: "Warehouse IT Inventory" }));

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-100 text-slate-950">
        <div className="min-h-screen lg:flex">
          <AppNav siteName={settings.siteName} />
          <main className="w-full min-w-0 px-4 pb-32 pt-5 sm:px-6 sm:pb-32 sm:pt-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
