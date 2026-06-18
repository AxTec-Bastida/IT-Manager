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
