/**
 * The only safe way to put a link someone typed into an href. Allows web, email and phone links and in-app paths;
 * "example.com" becomes "https://example.com"; anything else (javascript:, data:, vbscript:…) gives no link at all,
 * so a saved "link" can never run code for whoever clicks it.
 */
export function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return undefined;
  return `https://${u}`;
}
