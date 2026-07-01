import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/language/route";
import { createTranslator, dictionaries, isSupportedLocale, localeCookieName, normalizeLocale, SUPPORTED_LOCALES, t } from "@/lib/i18n";

describe("i18n helpers", () => {
  it("supports only English and Spanish with English fallback normalization", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en", "es"]);
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("es")).toBe(true);
    expect(isSupportedLocale("fr")).toBe(false);
    expect(normalizeLocale("es")).toBe("es");
    expect(normalizeLocale("fr")).toBe("en");
    expect(normalizeLocale(null)).toBe("en");
  });

  it("translates by namespace and falls back to English for missing Spanish keys", () => {
    expect(t("es", "scan.title")).toBe("Escaneo con cámara");
    expect(t("es", "common.activeCount", { count: 2 })).toBe("2 activos");
    expect(t("es", "notARealNamespace.key")).toBe("notARealNamespace.key");

    const spanishScan = dictionaries.es.scan as Record<string, string | undefined>;
    const original = spanishScan.title;
    // Simulate an intentionally missing Spanish key without mutating the real dictionary permanently.
    delete spanishScan.title;
    expect(t("es", "scan.title")).toBe("Camera scan");
    spanishScan.title = original;
  });

  it("creates namespace translators", () => {
    const scan = createTranslator("es", "scan");
    expect(scan("scanIntoActiveAudit")).toBe("Escanear en auditoría activa");
  });

  it("keeps implemented English dictionary keys present in Spanish", () => {
    const english = dictionaries.en as Record<string, Record<string, string>>;
    const spanish = dictionaries.es as Record<string, Record<string, string>>;
    for (const namespace of Object.keys(english)) {
      const englishKeys = Object.keys(english[namespace]);
      const spanishKeys = Object.keys(spanish[namespace]);
      expect(spanishKeys).toEqual(expect.arrayContaining(englishKeys));
    }
  });
});

describe("language API", () => {
  it("sets the locale cookie for supported locales", async () => {
    const request = new NextRequest("http://localhost/api/language", {
      method: "POST",
      body: JSON.stringify({ locale: "es" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ locale: "es" });
    expect(response.cookies.get(localeCookieName)?.value).toBe("es");
  });

  it("rejects unsupported locales instead of silently changing language", async () => {
    const request = new NextRequest("http://localhost/api/language", {
      method: "POST",
      body: JSON.stringify({ locale: "fr" }),
      headers: { "content-type": "application/json" },
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
    expect(response.cookies.get(localeCookieName)).toBeUndefined();
  });
});
