import { parse } from 'tldts';

export function getCookieUrlFromDomain(domain: string) {
  // allowPrivateDomains: without it, a host under a private public suffix
  // (e.g. *.hstgr.cloud) yields the suffix itself, and browsers reject the cookie.
  const url = parse(domain, { allowPrivateDomains: true });
  return url.domain! ? '.' + url.domain! : url.hostname!;
}
