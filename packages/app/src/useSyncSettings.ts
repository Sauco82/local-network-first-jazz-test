import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildSyncCandidates,
  canControlLocalSync as canControlLocalSyncCapability,
  resolveSyncPeerResult,
  readStoredSyncMode,
  syncCandidateOrder,
  type SyncAvailability,
  type SyncCandidate,
  writeStoredSyncMode,
  type DesktopSyncStatus,
  type ResolvedSyncPeer,
  type SyncOptionState,
  type SyncMode,
  type SyncTargetSource,
} from "./runtime";

export type SyncSettingsState = {
  mode: SyncMode;
  setMode: (mode: SyncMode) => void;
  hardcodedPeer?: string;
  desktopStatus: DesktopSyncStatus | null;
  actionPending: boolean;
  actionError: string | null;
  canControlLocalSync: boolean;
  syncWhen: "always" | "never";
  isResolvingPeer: boolean;
  optionStates: Record<SyncTargetSource, SyncOptionState>;
  resolvedPeer: ResolvedSyncPeer;
  refreshDesktopStatus: () => Promise<void>;
  startLocalSync: () => Promise<void>;
  stopLocalSync: () => Promise<void>;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected sync error.";
}

function buildInitialOptionStates(
  candidates: Record<SyncTargetSource, SyncCandidate>,
): Record<SyncTargetSource, SyncOptionState> {
  return {
    cloud: {
      source: "cloud",
      peer: candidates.cloud.peer,
      availability: "checking",
      note: null,
    },
    "local-desktop": {
      source: "local-desktop",
      peer: candidates["local-desktop"].peer,
      availability: candidates["local-desktop"].peer ? "checking" : "not-configured",
      note: candidates["local-desktop"].note,
    },
    "hardcoded-lan": {
      source: "hardcoded-lan",
      peer: candidates["hardcoded-lan"].peer,
      availability: candidates["hardcoded-lan"].peer ? "checking" : "not-configured",
      note: candidates["hardcoded-lan"].note,
    },
  };
}

async function probePeerAvailability(source: SyncTargetSource, peer: SyncCandidate["peer"]): Promise<SyncAvailability> {
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
  hardcodedPeer,
}: {
  apiKey?: string;
  hardcodedPeer?: string;
}): SyncSettingsState {
  const [mode, setStoredMode] = useState<SyncMode>(() => readStoredSyncMode());
  const [desktopStatus, setDesktopStatus] = useState<DesktopSyncStatus | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [syncWhen, setSyncWhen] = useState<"always" | "never">("never");
  const [isResolvingPeer, setIsResolvingPeer] = useState(true);

  const canControlLocalSync = canControlLocalSyncCapability();

  const candidates = useMemo(
    () =>
      buildSyncCandidates({
        apiKey,
        hardcodedPeer,
        desktopStatus,
      }),
    [apiKey, hardcodedPeer, desktopStatus],
  );

  const [optionStates, setOptionStates] = useState<Record<SyncTargetSource, SyncOptionState>>(() =>
    buildInitialOptionStates(candidates),
  );
  const [resolvedPeer, setResolvedPeer] = useState<ResolvedSyncPeer>(() => ({
    requestedMode: mode,
    activeSource: "none",
    peer: null,
    detail: "Resolving sync peer availability…",
    warning: null,
  }));

  const setMode = useCallback((nextMode: SyncMode) => {
    setSyncWhen("never");
    setIsResolvingPeer(true);
    setResolvedPeer({
      requestedMode: nextMode,
      activeSource: "none",
      peer: null,
      detail: "Resolving sync peer availability…",
      warning: null,
    });
    setStoredMode(nextMode);
  }, []);

  useEffect(() => {
    writeStoredSyncMode(mode);
  }, [mode]);

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
      requestedMode: mode,
      activeSource: "none",
      peer: null,
      detail: "Disconnecting from local desktop sync…",
      warning: null,
    });
    await runDesktopAction(() => window.desktopShell!.sync.stopLocalServer());
  }, [mode, runDesktopAction]);

  useEffect(() => {
    let active = true;
    const nextOptionStates = buildInitialOptionStates(candidates);

    setIsResolvingPeer(true);
    setSyncWhen("never");
    setOptionStates(nextOptionStates);
    setResolvedPeer({
      requestedMode: mode,
      activeSource: "none",
      peer: null,
      detail: "Resolving sync peer availability…",
      warning: null,
    });

    void Promise.all(
      (Object.keys(candidates) as SyncTargetSource[]).map(async (source) => {
        const candidate = candidates[source];
        const availability = await probePeerAvailability(source, candidate.peer);
        return {
          source,
          state: {
            source,
            peer: candidate.peer,
            availability,
            note: candidate.note,
          } satisfies SyncOptionState,
        };
      }),
    ).then((results) => {
      if (!active) {
        return;
      }

      const resolvedOptionStates = results.reduce<Record<SyncTargetSource, SyncOptionState>>(
        (acc, entry) => {
          acc[entry.source] = entry.state;
          return acc;
        },
        { ...nextOptionStates },
      );

      const selectedSource =
        syncCandidateOrder(mode).find(
          (source) => resolvedOptionStates[source].availability === "available",
        ) ?? null;

      setOptionStates(resolvedOptionStates);
      setResolvedPeer(
        resolveSyncPeerResult({
          mode,
          selectedSource,
          optionStates: resolvedOptionStates,
        }),
      );
      setSyncWhen(selectedSource ? "always" : "never");
      setIsResolvingPeer(false);
    });

    return () => {
      active = false;
    };
  }, [candidates, mode]);

  return {
    mode,
    setMode,
    hardcodedPeer,
    desktopStatus,
    actionPending,
    actionError,
    canControlLocalSync,
    syncWhen,
    isResolvingPeer,
    optionStates,
    resolvedPeer,
    refreshDesktopStatus,
    startLocalSync,
    stopLocalSync,
  };
}
