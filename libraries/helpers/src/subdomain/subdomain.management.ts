import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  // Scope the cookie to the full host, not the registrable domain: the bundled
  // Public Suffix List can lag behind browsers' (e.g. hstgr.cloud), and a cookie
  // set on a public suffix is rejected (Chrome). Front and API share one host.
  const url = parse(domain, { allowPrivateDomains: true });
  return url.domain! ? '.' + url.hostname! : url.hostname!;
}
