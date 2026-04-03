import { resolveJazzPeer } from "@repo/jazz";
import type { AccountRole } from "@repo/jazz";

export type AppRuntime = "web" | "desktop";
export type SyncMode = "auto" | "cloud" | "local-desktop" | "hardcoded-lan";
export type SyncTargetSource = "cloud" | "local-desktop" | "hardcoded-lan";
export type SyncAvailability = "checking" | "available" | "unavailable" | "not-configured";

export type DesktopSyncStatus = {
  running: boolean;
  host: string | null;
  port: number | null;
  peer: string | null;
  dbPath: string | null;
  error: string | null;
};

export type ResolvedSyncPeer = {
  requestedMode: SyncMode;
  activeSource: SyncTargetSource | "none";
  peer: string | null;
  detail: string;
  warning: string | null;
};

export type SyncOptionState = {
  source: SyncTargetSource;
  peer: string | null;
  availability: SyncAvailability;
  note: string | null;
};

export type SyncCandidate = {
  source: SyncTargetSource;
  peer: `ws://${string}` | `wss://${string}` | null;
  note: string | null;
};

declare global {
  interface Window {
    desktopShell?: {
      platform: string;
      hostname: string;
      sync: {
        getStatus(): Promise<DesktopSyncStatus>;
        startLocalServer(): Promise<DesktopSyncStatus>;
        stopLocalServer(): Promise<DesktopSyncStatus>;
        onStatusChange(listener: (status: DesktopSyncStatus) => void): () => void;
      };
    };
  }
}

export const INVITE_VALUE_HINT = "userData";
export const DEFAULT_SYNC_MODE: SyncMode = "auto";
export const SYNC_MODE_STORAGE_KEY = "jazz-sync-mode";

/**
 * Legacy hash segment for `#/invite/game/…` URLs. Old links are redirected to `#/game/:id`;
 * access is granted when the host adds the guest user group as a writer on the game ACL.
 */
export const INVITE_GAME_HINT = "game";

export const INVITE_ROLES: AccountRole[] = ["reader", "writer", "manager", "admin", "writeOnly"];
export const SYNC_MODE_OPTIONS: { value: SyncMode; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "cloud", label: "Cloud" },
  { value: "local-desktop", label: "Local desktop" },
  { value: "hardcoded-lan", label: "Hardcoded LAN" },
];

export function hasDesktopShell(): boolean {
  return typeof window !== "undefined" && window.desktopShell !== undefined;
}

export function canControlLocalSync(): boolean {
  return (
    typeof window !== "undefined" &&
    window.desktopShell?.sync !== undefined
  );
}

export function detectRuntime(): AppRuntime {
  if (hasDesktopShell()) {
    return "desktop";
  }
  return "web";
}

export function syncTargetLabel(source: SyncTargetSource): string {
  if (source === "local-desktop") {
    return "Local desktop";
  }
  if (source === "hardcoded-lan") {
    return "Hardcoded LAN";
  }
  return "Cloud";
}

export function isSyncMode(value: string): value is SyncMode {
  return SYNC_MODE_OPTIONS.some((option) => option.value === value);
}

export function readStoredSyncMode(): SyncMode {
  if (typeof window === "undefined") {
    return DEFAULT_SYNC_MODE;
  }
  const value = window.localStorage.getItem(SYNC_MODE_STORAGE_KEY);
  return value && isSyncMode(value) ? value : DEFAULT_SYNC_MODE;
}

export function writeStoredSyncMode(mode: SyncMode) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SYNC_MODE_STORAGE_KEY, mode);
}

export function buildSyncCandidates({
  apiKey,
  hardcodedPeer,
  desktopStatus,
}: {
  apiKey?: string;
  hardcodedPeer?: string;
  desktopStatus?: DesktopSyncStatus | null;
}): Record<SyncTargetSource, SyncCandidate> {
  const cloudPeer = resolveJazzPeer({ apiKey });
  const localDesktopPeer =
    desktopStatus?.running && desktopStatus.peer?.trim()
      ? (desktopStatus.peer.trim() as `ws://${string}` | `wss://${string}`)
      : null;
  const lanPeer = hardcodedPeer?.trim()
    ? (hardcodedPeer.trim() as `ws://${string}` | `wss://${string}`)
    : null;

  return {
    cloud: {
      source: "cloud",
      peer: cloudPeer,
      note: null,
    },
    "local-desktop": {
      source: "local-desktop",
      peer: localDesktopPeer,
      note: desktopStatus?.running
        ? null
        : desktopStatus?.error ?? "Start the local desktop sync server.",
    },
    "hardcoded-lan": {
      source: "hardcoded-lan",
      peer: lanPeer,
      note: lanPeer ? null : "Set VITE_JAZZ_HARDCODED_PEER to enable this option.",
    },
  };
}

export function syncCandidateOrder(mode: SyncMode): SyncTargetSource[] {
  if (mode === "cloud") {
    return ["cloud"];
  }
  if (mode === "hardcoded-lan") {
    return ["hardcoded-lan", "local-desktop", "cloud"];
  }
  return ["local-desktop", "hardcoded-lan", "cloud"];
}

export function buildSyncModeOptionLabel(
  mode: SyncMode,
  optionStates: Partial<Record<SyncTargetSource, SyncOptionState>>,
): string {
  const base = SYNC_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
  if (mode === "auto") {
    return base;
  }
  const state = optionStates[mode];
  if (!state) {
    return `${base} (checking)`;
  }
  if (state.availability === "available") {
    return `${base} (available)`;
  }
  if (state.availability === "not-configured") {
    return `${base} (not configured)`;
  }
  if (state.availability === "checking") {
    return `${base} (checking)`;
  }
  return `${base} (unavailable)`;
}

export function resolveSyncPeerResult({
  mode,
  selectedSource,
  optionStates,
}: {
  mode: SyncMode;
  selectedSource: SyncTargetSource | null;
  optionStates: Record<SyncTargetSource, SyncOptionState>;
}): ResolvedSyncPeer {
  if (!selectedSource) {
    return {
      requestedMode: mode,
      activeSource: "none",
      peer: null,
      detail: "No reachable sync peer. Running local-only until one becomes available.",
      warning: "Could not connect to any configured sync server.",
    };
  }

  const selected = optionStates[selectedSource];
  const desiredSource = mode === "auto" ? selectedSource : mode;
  const desiredLabel = syncTargetLabel(desiredSource);
  const selectedLabel = syncTargetLabel(selectedSource);
  const warning =
    mode !== "auto" && desiredSource !== selectedSource
      ? `Requested ${desiredLabel}, connected to ${selectedLabel} instead.`
      : null;

  return {
    requestedMode: mode,
    activeSource: selectedSource,
    peer: selected.peer,
    detail:
      mode === "auto"
        ? `Auto connected to ${selectedLabel}.`
        : warning
          ? warning
          : `Connected to ${selectedLabel}.`,
    warning,
  };
}

export function defaultUserLabel(runtime: AppRuntime): string {
  if (typeof window !== "undefined") {
    const host = window.desktopShell?.hostname;
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
