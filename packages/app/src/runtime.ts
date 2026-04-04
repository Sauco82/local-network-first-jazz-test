import { resolveJazzPeer } from "@repo/jazz";
import type { AccountRole } from "@repo/jazz";

export type AppRuntime = "web" | "desktop";
export type SyncPeer = `ws://${string}` | `wss://${string}`;
export type SyncAvailability = "checking" | "available" | "unavailable" | "not-configured";
export type SyncTargetSource = "cloud" | "desktop-loopback" | "desktop-advertised" | "stored-peer";

export type DesktopAdvertisedPeer = {
  id: string;
  label: string;
  hostname: string;
  peer: SyncPeer;
  note: string | null;
};

export type DesktopSyncStatus = {
  running: boolean;
  host: string;
  port: number;
  peer: SyncPeer;
  loopbackPeer: SyncPeer;
  advertisedHostnames: string[];
  advertisedPeers: DesktopAdvertisedPeer[];
  dbPath: string | null;
  error: string | null;
};

export type StoredSyncPeer = {
  id: string;
  label: string | null;
  peer: SyncPeer;
};

export type SyncTarget = {
  id: string;
  source: SyncTargetSource;
  label: string;
  peer: SyncPeer | null;
  note: string | null;
  removable: boolean;
};

export type ResolvedSyncPeer = {
  selectedTargetId: string;
  activeSource: SyncTargetSource | "none";
  peer: string | null;
  detail: string;
  warning: string | null;
};

export type SyncOptionState = SyncTarget & {
  availability: SyncAvailability;
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
        setAdvertisedHostnames(hostnames: string[]): Promise<DesktopSyncStatus>;
        onStatusChange(listener: (status: DesktopSyncStatus) => void): () => void;
      };
    };
  }
}

export const INVITE_VALUE_HINT = "userData";
export const DEFAULT_SELECTED_SYNC_TARGET_ID = "cloud";
export const SELECTED_SYNC_TARGET_STORAGE_KEY = "jazz-selected-sync-target";
export const STORED_SYNC_PEERS_STORAGE_KEY = "jazz-stored-sync-peers";
export const DEFAULT_LOCAL_SYNC_HOST = "127.0.0.1";
export const DEFAULT_LOCAL_SYNC_PORT = 4200;

/**
 * Legacy hash segment for `#/invite/game/…` URLs. Old links are redirected to `#/game/:id`;
 * access is granted when the host adds the guest user group as a writer on the game ACL.
 */
export const INVITE_GAME_HINT = "game";

export const INVITE_ROLES: AccountRole[] = ["reader", "writer", "manager", "admin", "writeOnly"];

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
  if (source === "desktop-loopback") {
    return "This desktop";
  }
  if (source === "desktop-advertised") {
    return "Desktop .local URL";
  }
  if (source === "stored-peer") {
    return "Saved peer";
  }
  return "Cloud";
}

export function buildLocalSyncPeer({
  host = DEFAULT_LOCAL_SYNC_HOST,
  port = DEFAULT_LOCAL_SYNC_PORT,
}: {
  host?: string;
  port?: number;
} = {}): SyncPeer {
  return `ws://${host}:${port}` as SyncPeer;
}

function buildPeerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `peer-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSyncPeer(value: string): SyncPeer | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return null;
    }
    return parsed.toString().replace(/\/$/u, "") as SyncPeer;
  } catch {
    return null;
  }
}

export function createStoredSyncPeer(peer: string, label?: string | null): StoredSyncPeer | null {
  const normalizedPeer = normalizeSyncPeer(peer);
  if (!normalizedPeer) {
    return null;
  }

  const trimmedLabel = label?.trim() ?? "";

  return {
    id: buildPeerId(),
    label: trimmedLabel.length > 0 ? trimmedLabel : null,
    peer: normalizedPeer,
  };
}

export function readSelectedSyncTargetId(): string {
  if (typeof window === "undefined") {
    return DEFAULT_SELECTED_SYNC_TARGET_ID;
  }
  return window.localStorage.getItem(SELECTED_SYNC_TARGET_STORAGE_KEY) ?? DEFAULT_SELECTED_SYNC_TARGET_ID;
}

export function writeSelectedSyncTargetId(targetId: string) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SELECTED_SYNC_TARGET_STORAGE_KEY, targetId);
}

export function readStoredSyncPeers(): StoredSyncPeer[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORED_SYNC_PEERS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return [];
      }

      const peer = normalizeSyncPeer(String((entry as { peer?: unknown }).peer ?? ""));
      if (!peer) {
        return [];
      }

      const id = String((entry as { id?: unknown }).id ?? buildPeerId());
      const label = (entry as { label?: unknown }).label;

      return [
        {
          id,
          label: typeof label === "string" && label.trim().length > 0 ? label.trim() : null,
          peer,
        } satisfies StoredSyncPeer,
      ];
    });
  } catch {
    return [];
  }
}

export function writeStoredSyncPeers(peers: StoredSyncPeer[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORED_SYNC_PEERS_STORAGE_KEY, JSON.stringify(peers));
}

export function storedSyncPeerLabel(peer: StoredSyncPeer): string {
  return peer.label?.trim() || peer.peer;
}

export function buildSyncTargets({
  apiKey,
  desktopStatus,
  storedPeers,
}: {
  apiKey?: string;
  desktopStatus: DesktopSyncStatus | null;
  storedPeers: StoredSyncPeer[];
}): SyncTarget[] {
  const cloudPeer = resolveJazzPeer({ apiKey });

  const targets: SyncTarget[] = [
    {
      id: DEFAULT_SELECTED_SYNC_TARGET_ID,
      source: "cloud",
      label: "Cloud",
      peer: cloudPeer,
      note: null,
      removable: false,
    },
  ];
  const seenPeers = new Set<string>([cloudPeer]);

  if (desktopStatus) {
    targets.push({
      id: "desktop-loopback",
      source: "desktop-loopback",
      label: "This desktop (loopback)",
      peer: desktopStatus.loopbackPeer,
      note: desktopStatus.running
        ? "Connect locally to the sync server hosted by this desktop app."
        : "Start local sync to use the loopback peer.",
      removable: false,
    });
    seenPeers.add(desktopStatus.loopbackPeer);

    for (const peer of desktopStatus.advertisedPeers) {
      if (seenPeers.has(peer.peer)) {
        continue;
      }

      targets.push({
        id: peer.id,
        source: "desktop-advertised",
        label: peer.label,
        peer: peer.peer,
        note: peer.note,
        removable: false,
      });
      seenPeers.add(peer.peer);
    }
  }

  for (const storedPeer of storedPeers) {
    if (seenPeers.has(storedPeer.peer)) {
      continue;
    }

    targets.push({
      id: storedPeer.id,
      source: "stored-peer",
      label: storedSyncPeerLabel(storedPeer),
      peer: storedPeer.peer,
      note: null,
      removable: true,
    });
    seenPeers.add(storedPeer.peer);
  }

  return targets;
}

export function resolveSyncPeerResult({
  selectedTargetId,
  optionStatesById,
}: {
  selectedTargetId: string;
  optionStatesById: Record<string, SyncOptionState>;
}): ResolvedSyncPeer {
  const selected = optionStatesById[selectedTargetId];
  if (!selected) {
    return {
      selectedTargetId,
      activeSource: "none",
      peer: null,
      detail: "Select a sync target to mount Jazz.",
      warning: "The selected sync target is no longer configured.",
    };
  }

  if (selected.availability !== "available") {
    const reason =
      selected.availability === "checking"
        ? `Checking ${selected.label}…`
        : selected.availability === "not-configured"
          ? `${selected.label} is not configured.`
          : `${selected.label} is unavailable.`;

    return {
      selectedTargetId,
      activeSource: "none",
      peer: null,
      detail: reason,
      warning: "Switch targets or fix the selected peer URL to continue.",
    };
  }

  return {
    selectedTargetId,
    activeSource: selected.source,
    peer: selected.peer,
    detail: `Connected to ${selected.label}.`,
    warning: null,
  };
}

export function buildSyncTargetOptionLabel(option: SyncOptionState): string {
  if (option.availability === "available") {
    return `${option.label} (available)`;
  }
  if (option.availability === "not-configured") {
    return `${option.label} (not configured)`;
  }
  if (option.availability === "checking") {
    return `${option.label} (checking)`;
  }
  return `${option.label} (unavailable)`;
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
