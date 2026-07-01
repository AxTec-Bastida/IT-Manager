import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

describe("user manual", () => {
  it("keeps the in-app user manual and handoff Markdown available", () => {
    const pagePath = path.join(root, "app", "manual", "user", "page.tsx");
    const resourcesPath = path.join(root, "app", "tools", "page.tsx");
    const markdownPath = path.join(root, "docs", "USER-MANUAL.md");
    const spanishMarkdownPath = path.join(root, "docs", "MANUAL-DE-USUARIO.md");
    const i18nPath = path.join(root, "lib", "i18n.ts");

    expect(existsSync(pagePath)).toBe(true);
    expect(existsSync(resourcesPath)).toBe(true);
    expect(existsSync(markdownPath)).toBe(true);
    expect(existsSync(spanishMarkdownPath)).toBe(true);
    expect(existsSync(i18nPath)).toBe(true);

    const page = readFileSync(pagePath, "utf8");
    const resources = readFileSync(resourcesPath, "utf8");
    const markdown = readFileSync(markdownPath, "utf8");
    const spanishMarkdown = readFileSync(spanishMarkdownPath, "utf8");
    const i18n = readFileSync(i18nPath, "utf8");

    expect(page).toContain("Warehouse IT User Manual");
    expect(page).toContain("Manual De Usuario Warehouse IT");
    expect(page).toContain("/manual/user?lang=es");
    expect(page).toContain("/manual/user/01-navigation.svg");
    expect(page).toContain("Alejandro Bastida");
    expect(page).toContain("https://github.com/AxTec-Bastida/IT-Manager");
    expect(resources).toContain("Project stewardship");
    expect(resources).toContain("Alejandro Bastida");
    expect(resources).toContain("https://github.com/AxTec-Bastida/IT-Manager");
    expect(markdown).toContain("# Warehouse IT Inventory User Manual");
    expect(markdown).toContain("Do not store passwords");
    expect(markdown).toContain("Alejandro Bastida");
    expect(markdown).toContain("https://github.com/AxTec-Bastida/IT-Manager");
    expect(spanishMarkdown).toContain("# Manual De Usuario Warehouse IT Inventory");
    expect(spanishMarkdown).toContain("No guardes contrasenas");
    expect(spanishMarkdown).toContain("AxTec Bastida");
    expect(i18n).toContain("warehouse_locale");
    expect(i18n).toContain("Español");
  });

  it("keeps the language switcher wired into the app shell", () => {
    const layout = readFileSync(path.join(root, "app", "layout.tsx"), "utf8");
    const nav = readFileSync(path.join(root, "components", "nav.tsx"), "utf8");
    const switcher = readFileSync(path.join(root, "components", "language-switcher.tsx"), "utf8");
    const boundary = readFileSync(path.join(root, "components", "translation-boundary.tsx"), "utf8");
    const uiTranslations = readFileSync(path.join(root, "lib", "ui-translations.ts"), "utf8");
    const route = readFileSync(path.join(root, "app", "api", "language", "route.ts"), "utf8");

    expect(layout).toContain("localeCookieName");
    expect(layout).toContain("locale={locale}");
    expect(layout).toContain("TranslationBoundary");
    expect(nav).toContain("LanguageSwitcher");
    expect(nav).toContain("navText[locale]");
    expect(switcher).toContain("/api/language");
    expect(switcher).toContain("window.location.reload()");
    expect(boundary).toContain("MutationObserver");
    expect(boundary).toContain("translateExactText");
    expect(uiTranslations).toContain("Add Asset");
    expect(uiTranslations).toContain("Agregar activo");
    expect(uiTranslations).toContain("Authentication required.");
    expect(uiTranslations).toContain("Autenticación requerida.");
    expect(route).toContain("response.cookies.set");
  });

  it("keeps the dashboard from becoming a mixed-language shell", () => {
    const dashboard = readFileSync(path.join(root, "app", "dashboard", "page.tsx"), "utf8");

    expect(dashboard).toContain("localeCookieName");
    expect(dashboard).toContain("dashboardText");
    expect(dashboard).toContain("¿Qué quieres hacer hoy?");
    expect(dashboard).toContain("Necesita atención");
    expect(dashboard).toContain("Resumen de inventario");
  });

  it("keeps the user manual workflow diagrams in public assets", () => {
    for (const name of [
      "01-navigation.svg",
      "02-quick-scan.svg",
      "03-inventory.svg",
      "04-intake-labels.svg",
      "05-responsibility.svg",
      "06-repair-maintenance.svg",
      "07-compliance.svg",
      "08-facturas-values.svg",
      "09-audits-offline.svg",
      "10-alerts-admin.svg",
    ]) {
      expect(existsSync(path.join(root, "public", "manual", "user", name))).toBe(true);
    }
  });
});
