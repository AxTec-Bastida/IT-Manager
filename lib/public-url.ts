import type { NextRequest } from "next/server";

export function appUrl(path: string, requestUrl: string | URL, env: NodeJS.ProcessEnv = process.env) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const configured = env.APP_BASE_URL?.trim();
  if (configured) {
    try {
      const base = new URL(configured);
      if (base.protocol === "http:" || base.protocol === "https:") {
        return new URL(safePath, `${base.origin}/`);
      }
    } catch {
      // Fall back to the incoming request URL when APP_BASE_URL is malformed.
    }
  }
  return new URL(safePath, requestUrl);
}

export function requestUrl(path: string, request: Pick<NextRequest, "headers" | "url">) {
  const safePath = path.startsWith("/") ? path : `/${path}`;
  const fallback = new URL(request.url);
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const host = forwardedHost || request.headers.get("host") || fallback.host;
  const proto = forwardedProto || fallback.protocol.replace(/:$/, "");

  if (!host) return new URL(safePath, fallback);
  return new URL(safePath, `${proto}://${host}`);
}

function firstForwardedValue(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}
