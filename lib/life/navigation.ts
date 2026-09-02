export type LifeNavHref = "/" | "/food" | "/calendar" | "/nest" | "/me";

export function isLifeNavItemActive(pathname: string, href: LifeNavHref) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
