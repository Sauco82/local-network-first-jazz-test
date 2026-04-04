import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_SELECTED_SYNC_TARGET_ID,
  buildSyncTargets,
  canControlLocalSync as canControlLocalSyncCapability,
  createStoredSyncPeer,
  readSelectedSyncTargetId,
  readStoredSyncPeers,
  resolveSyncPeerResult,
  type DesktopSyncStatus,
  type ResolvedSyncPeer,
  type StoredSyncPeer,
  type SyncAvailability,
  type SyncOptionState,
  type SyncPeer,
  type SyncTarget,
  writeSelectedSyncTargetId,
  writeStoredSyncPeers,
} from "./runtime";

export type SyncSettingsState = {
  selectedTargetId: string;
  setSelectedTargetId: (targetId: string) => void;
  desktopStatus: DesktopSyncStatus | null;
  actionPending: boolean;
  actionError: string | null;
  canControlLocalSync: boolean;
  syncWhen: "always" | "never";
  isResolvingPeer: boolean;
  optionStates: SyncOptionState[];
  resolvedPeer: ResolvedSyncPeer;
  storedPeers: StoredSyncPeer[];
  addStoredPeer: (peer: string, label?: string | null) => boolean;
  removeStoredPeer: (peerId: string) => void;
  setDesktopAdvertisedHostnames: (hostnames: string[]) => Promise<void>;
  refreshDesktopStatus: () => Promise<void>;
  startLocalSync: () => Promise<void>;
  stopLocalSync: () => Promise<void>;
};

const SYNC_REPROBE_INTERVAL_MS = 4000;

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected sync error.";
}

function buildInitialOptionStates(targets: SyncTarget[]): SyncOptionState[] {
  return targets.map((target) => ({
    ...target,
    availability: target.peer ? "checking" : "not-configured",
  }));
}

async function probePeerAvailability(peer: SyncPeer | null): Promise<SyncAvailability> {
  if (!peer) {
    return "not-configured";
  }

  return new Promise<SyncAvailability>((resolve) => {
    let settled = false;
    let socket: WebSocket | null = null;
    const timeoutId = window.setTimeout(() => finish("unavailable"), 1500);

    function finish(result: SyncAvailability) {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timeoutId);
      if (socket) {
        socket.onopen = null;
        socket.onerror = null;
        socket.onclose = null;
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
      resolve(result);
    }

    try {
      socket = new WebSocket(peer);
      socket.onopen = () => finish("available");
      socket.onerror = () => finish("unavailable");
      socket.onclose = () => finish("unavailable");
    } catch {
      finish("unavailable");
    }
  });
}

export function useSyncSettings({
  apiKey,
}: {
  apiKey?: string;
}): SyncSettingsState {
  const [selectedTargetId, setStoredSelectedTargetId] = useState<string>(() => readSelectedSyncTargetId());
  const [desktopStatus, setDesktopStatus] = useState<DesktopSyncStatus | null>(null);
  const [storedPeers, setStoredPeers] = useState<StoredSyncPeer[]>(() => readStoredSyncPeers());
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncWhen, setSyncWhen] = useState<"always" | "never">("never");
  const [isResolvingPeer, setIsResolvingPeer] = useState(true);
  const [probeCycle, setProbeCycle] = useState(0);

  const canControlLocalSync = canControlLocalSyncCapability();

  const targets = useMemo(
    () =>
      buildSyncTargets({
        apiKey,
        desktopStatus,
        storedPeers,
      }),
    [apiKey, desktopStatus, storedPeers],
  );

  const [optionStates, setOptionStates] = useState<SyncOptionState[]>(() => buildInitialOptionStates(targets));
  const [resolvedPeer, setResolvedPeer] = useState<ResolvedSyncPeer>(() => ({
    selectedTargetId,
    activeSource: "none",
    peer: null,
    detail: "Resolving sync peer availability…",
    warning: null,
  }));

  const setSelectedTargetId = useCallback((nextTargetId: string) => {
    setSyncWhen("never");
    setIsResolvingPeer(true);
    setResolvedPeer({
      selectedTargetId: nextTargetId,
      activeSource: "none",
      peer: null,
      detail: "Resolving sync peer availability…",
      warning: null,
    });
    setStoredSelectedTargetId(nextTargetId);
  }, []);

  const requestReprobe = useCallback(() => {
    setProbeCycle((current) => current + 1);
  }, []);

  useEffect(() => {
    writeSelectedSyncTargetId(selectedTargetId);
  }, [selectedTargetId]);

  useEffect(() => {
    writeStoredSyncPeers(storedPeers);
  }, [storedPeers]);

  useEffect(() => {
    if (targets.some((target) => target.id === selectedTargetId)) {
      return;
    }

    setStoredSelectedTargetId(DEFAULT_SELECTED_SYNC_TARGET_ID);
  }, [selectedTargetId, targets]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      requestReprobe();
    }, SYNC_REPROBE_INTERVAL_MS);

    const handleWindowFocus = () => {
      requestReprobe();
    };

    window.addEventListener("focus", handleWindowFocus);
    window.addEventListener("online", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("online", handleWindowFocus);
    };
  }, [requestReprobe]);

  const refreshDesktopStatus = useCallback(async () => {
    if (!canControlLocalSync || !window.desktopShell) {
      return;
    }
    try {
      const status = await window.desktopShell.sync.getStatus();
      setDesktopStatus(status);
      setActionError(null);
    } catch (error) {
      setActionError(toErrorMessage(error));
    }
  }, [canControlLocalSync]);

  useEffect(() => {
    if (!canControlLocalSync || !window.desktopShell) {
      setDesktopStatus(null);
      return;
    }

    let active = true;
    void window.desktopShell.sync
      .getStatus()
      .then((status: DesktopSyncStatus) => {
        if (active) {
          setDesktopStatus(status);
          setActionError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setActionError(toErrorMessage(error));
        }
      });

    const unsubscribe = window.desktopShell.sync.onStatusChange((status: DesktopSyncStatus) => {
      if (!active) {
        return;
      }
      setDesktopStatus(status);
      setActionError(null);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [canControlLocalSync]);

  const runDesktopAction = useCallback(
    async (action: () => Promise<DesktopSyncStatus>) => {
      if (!canControlLocalSync) {
        return;
      }
      setActionPending(true);
      setActionError(null);
      try {
        const status = await action();
        setDesktopStatus(status);
      } catch (error) {
        setActionError(toErrorMessage(error));
      } finally {
        setActionPending(false);
      }
    },
    [canControlLocalSync],
  );

  const setDesktopAdvertisedHostnames = useCallback(async (hostnames: string[]) => {
    if (!window.desktopShell) {
      return;
    }

    await runDesktopAction(() => window.desktopShell!.sync.setAdvertisedHostnames(hostnames));
  }, [runDesktopAction]);

  const startLocalSync = useCallback(async () => {
    if (!window.desktopShell) {
      return;
    }
    await runDesktopAction(() => window.desktopShell!.sync.startLocalServer());
  }, [runDesktopAction]);

  const stopLocalSync = useCallback(async () => {
    if (!window.desktopShell) {
      return;
    }
    // Disconnect the current Jazz peer before tearing down the local server to avoid
    // the old websocket transport entering a reconnect loop against a dead socket.
    setSyncWhen("never");
    setIsResolvingPeer(true);
    setResolvedPeer({
      selectedTargetId,
      activeSource: "none",
      peer: null,
      detail: "Disconnecting from local desktop sync…",
      warning: null,
    });
    await runDesktopAction(() => window.desktopShell!.sync.stopLocalServer());
  }, [runDesktopAction, selectedTargetId]);

  const addStoredPeer = useCallback((peer: string, label?: string | null) => {
    const nextPeer = createStoredSyncPeer(peer, label);
    if (!nextPeer) {
      setActionError("Enter a valid ws:// or wss:// peer URL.");
      return false;
    }

    if (storedPeers.some((entry) => entry.peer === nextPeer.peer)) {
      setActionError("That peer URL is already saved.");
      return false;
    }

    setStoredPeers((current) => [...current, nextPeer]);
    setActionError(null);
    setIsResolvingPeer(true);
    return true;
  }, [storedPeers]);

  const removeStoredPeer = useCallback((peerId: string) => {
    setStoredPeers((current) => current.filter((peer) => peer.id !== peerId));
    if (selectedTargetId === peerId) {
      setSelectedTargetId(DEFAULT_SELECTED_SYNC_TARGET_ID);
    }
  }, [selectedTargetId, setSelectedTargetId]);

  useEffect(() => {
    let active = true;
    const nextOptionStates = buildInitialOptionStates(targets);

    void Promise.all(
      targets.map(async (target) => {
        const availability = await probePeerAvailability(target.peer);
        return {
          id: target.id,
          state: {
            ...target,
            availability,
          } satisfies SyncOptionState,
        };
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const resolvedOptionStates = results.reduce<SyncOptionState[]>(
        (acc, entry) => {
          const existingIndex = acc.findIndex((option) => option.id === entry.id);
          if (existingIndex === -1) {
            acc.push(entry.state);
            return acc;
          }
          acc[existingIndex] = entry.state;
          return acc;
        },
        [...nextOptionStates],
      );
      const optionStatesById = Object.fromEntries(
        resolvedOptionStates.map((option) => [option.id, option]),
      ) as Record<string, SyncOptionState>;

      const nextResolvedPeer = resolveSyncPeerResult({
        selectedTargetId,
        optionStatesById,
      });
      const nextSyncWhen = nextResolvedPeer.peer ? "always" : "never";
      const shouldApplyResolvedState =
        isResolvingPeer ||
        nextSyncWhen !== syncWhen ||
        nextResolvedPeer.selectedTargetId !== resolvedPeer.selectedTargetId ||
        nextResolvedPeer.activeSource !== resolvedPeer.activeSource ||
        nextResolvedPeer.peer !== resolvedPeer.peer ||
        nextResolvedPeer.detail !== resolvedPeer.detail ||
        nextResolvedPeer.warning !== resolvedPeer.warning;

      setOptionStates(resolvedOptionStates);
      if (shouldApplyResolvedState) {
        setResolvedPeer(nextResolvedPeer);
        setSyncWhen(nextSyncWhen);
      }
      if (isResolvingPeer) {
        setIsResolvingPeer(false);
      }
    });

    return () => {
      active = false;
    };
  }, [isResolvingPeer, probeCycle, resolvedPeer, selectedTargetId, syncWhen, targets]);

  return {
    selectedTargetId,
    setSelectedTargetId,
    desktopStatus,
    storedPeers,
    actionPending,
    actionError,
    canControlLocalSync,
    syncWhen,
    isResolvingPeer,
    optionStates,
    resolvedPeer,
    addStoredPeer,
    removeStoredPeer,
    setDesktopAdvertisedHostnames,
    refreshDesktopStatus,
    startLocalSync,
    stopLocalSync,
  };
}
