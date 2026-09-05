/** Shared by the login screen and server callbacks; never accepts a foreign origin. */
export function safeLocalCallbackUrl(value: unknown, baseUrl?: string): string {
  const fallback = "/dashboard";
  if (typeof value !== "string" || !value || value.length > 4096 || value !== value.trim()) return fallback;
  try {
    const base = new URL(baseUrl ?? "http://auth.local");
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) || url.origin !== base.origin || url.username || url.password) return fallback;
    if (!value.startsWith("/") && !baseUrl) return fallback;
    let decoded = value;
    for (let i = 0; i < 4; i++) {
      if (/[\\\u0000-\u001f\u007f]/.test(decoded) || decoded.startsWith("//")) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    let path = url.pathname;
    for (let i = 0; i < 4; i++) path = decodeURIComponent(path);
    if (path.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(path)) return fallback;
    // An auth callback must finish at an app page, never another auth endpoint.
    if (/^\/api\/auth(?:\/|$)/i.test(path)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
