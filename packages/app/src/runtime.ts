import type { AccountRole } from "@repo/jazz";

export type AppRuntime = "web" | "desktop";

export const INVITE_VALUE_HINT = "userData";

/** Hash segment for `#/invite/game/…` links to a `GameData` co-value. */
export const INVITE_GAME_HINT = "game";

export const INVITE_ROLES: AccountRole[] = ["reader", "writer", "manager", "admin", "writeOnly"];

export function defaultUserLabel(runtime: AppRuntime): string {
  if (typeof window !== "undefined") {
    const host = (window as { desktopShell?: { hostname?: string } }).desktopShell?.hostname;
    if (host) {
      return host;
    }
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.hostname} (browser)`;
  }
  return runtime === "desktop" ? "Desktop" : "Browser";
}

export function inviteBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function initialJoinUrlFromLocation(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const href = window.location.href;
  return href.includes("#/invite/") ? href : "";
}
