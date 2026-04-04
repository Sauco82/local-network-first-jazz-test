import { useEffect, useState } from "react";
import type { DeviceAccountFromHook } from "@repo/jazz";
import { Button, Card, TextField } from "@repo/ui";
import { buildSyncTargetOptionLabel, syncTargetLabel } from "../runtime";
import type { SyncSettingsState } from "../useSyncSettings";

export function JazzConfigCard({
  effectiveApiKey,
  account,
  syncState,
}: {
  effectiveApiKey: string;
  account?: DeviceAccountFromHook;
  syncState: SyncSettingsState;
}) {
  const [newPeerUrl, setNewPeerUrl] = useState("");
  const [newPeerLabel, setNewPeerLabel] = useState("");
  const [advertisedHostnamesInput, setAdvertisedHostnamesInput] = useState("");
  const loopbackOption = syncState.optionStates.find((option) => option.source === "desktop-loopback") ?? null;
  const selectedOption =
    syncState.optionStates.find((option) => option.id === syncState.selectedTargetId) ?? null;
  const shareablePeers = syncState.desktopStatus?.advertisedPeers ?? [];
  const removableOptions = syncState.optionStates.filter((option) => option.removable);
  const localStatusText =
    syncState.desktopStatus?.running
      ? `Server process running on ${syncState.desktopStatus.loopbackPeer}`
      : syncState.desktopStatus?.error
        ? `Server process stopped (${syncState.desktopStatus.error})`
        : "Server process stopped";

  const localAvailabilityText =
    loopbackOption?.availability === "available"
      ? "Loopback peer reachable"
      : loopbackOption?.availability === "checking"
        ? "Checking loopback peer…"
        : loopbackOption?.availability === "unavailable"
          ? "Loopback peer unavailable"
          : "Loopback peer not configured";

  useEffect(() => {
    setAdvertisedHostnamesInput((syncState.desktopStatus?.advertisedHostnames ?? []).join(", "));
  }, [syncState.desktopStatus?.advertisedHostnames]);

  return (
    <Card>
      <h2 className="text-xs font-semibold text-slate-900">Jazz</h2>
      <div className="mt-2 grid gap-3 text-[11px] leading-snug text-slate-600">
        <p>
          API key: <span className="font-mono font-medium text-sky-800">{effectiveApiKey}</span>
        </p>
        <p className="text-slate-500">
          Override via <code className="rounded bg-slate-100 px-0.5 text-[10px]">apps/web/.env</code> →{" "}
          <code className="rounded bg-slate-100 px-0.5 text-[10px]">VITE_JAZZ_API_KEY</code>
        </p>
        <div className="grid gap-1">
          <label className="flex flex-col gap-0.5 text-[10px] font-medium text-slate-600">
            Sync target
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              value={syncState.selectedTargetId}
              onChange={(event) => syncState.setSelectedTargetId(event.target.value)}
            >
              {syncState.optionStates.map((option) => (
                <option key={option.id} value={option.id}>
                  {buildSyncTargetOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <p>
            Selected target:{" "}
            <span className="text-slate-700">{selectedOption?.label ?? "not selected"}</span>
          </p>
          <p>
            Active peer:{" "}
            <span className="break-all font-mono text-[10px] text-slate-700">
              {syncState.resolvedPeer.peer ?? "not connected"}
            </span>
          </p>
          <p>
            Active source:{" "}
            <span className="text-slate-700">
              {syncState.resolvedPeer.activeSource === "none"
                ? "No active sync peer"
                : syncTargetLabel(syncState.resolvedPeer.activeSource)}
            </span>
          </p>
          <p>{syncState.resolvedPeer.detail}</p>
          {syncState.resolvedPeer.warning ? (
            <p className="text-amber-800">{syncState.resolvedPeer.warning}</p>
          ) : null}
          {syncState.isResolvingPeer ? <p className="text-slate-500">Checking configured peer availability…</p> : null}
          {!syncState.canControlLocalSync ? (
            <p className="text-slate-500">
              Browser clients can probe saved peer URLs, but only the desktop app can host local sync or manage
              advertised `.local` hostnames.
            </p>
          ) : null}
        </div>
        <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Saved peer URLs</p>
          <div className="grid gap-1.5">
            <TextField
              placeholder="ws://my-device.local:4200"
              value={newPeerUrl}
              onChange={(event) => setNewPeerUrl(event.target.value)}
            />
            <TextField
              placeholder="Optional label"
              value={newPeerLabel}
              onChange={(event) => setNewPeerLabel(event.target.value)}
            />
            <Button
              type="button"
              onClick={() => {
                const didAdd = syncState.addStoredPeer(newPeerUrl, newPeerLabel);
                if (!didAdd) {
                  return;
                }
                setNewPeerUrl("");
                setNewPeerLabel("");
              }}
            >
              Save peer URL
            </Button>
          </div>
          {removableOptions.length > 0 ? (
            <div className="grid gap-1.5">
              {removableOptions.map((option) => (
                <div
                  key={option.id}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700">{option.label}</p>
                      <p className="break-all font-mono text-slate-500">{option.peer}</p>
                      <p>{buildSyncTargetOptionLabel(option)}</p>
                    </div>
                    <Button
                      type="button"
                      className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      onClick={() => syncState.removeStoredPeer(option.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500">No saved peer URLs yet.</p>
          )}
        </div>
        {syncState.canControlLocalSync ? (
          <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Local desktop control</p>
            <p>{localStatusText}</p>
            <p>{localAvailabilityText}</p>
            <p className="text-slate-500">
              Bind host <span className="font-mono text-[10px] text-slate-700">{syncState.desktopStatus?.host}</span>
            </p>
            <p className="text-slate-500">
              Loopback peer{" "}
              <span className="break-all font-mono text-[10px] text-slate-700">
                {syncState.desktopStatus?.loopbackPeer ?? "not configured"}
              </span>
            </p>
            {loopbackOption?.note ? <p className="text-slate-500">{loopbackOption.note}</p> : null}
            {syncState.desktopStatus?.dbPath ? (
              <p className="break-all font-mono text-[10px] text-slate-500">{syncState.desktopStatus.dbPath}</p>
            ) : null}
            <label className="grid gap-1 text-[10px] font-medium text-slate-600">
              Advertised `.local` hostnames
              <TextField
                placeholder="my-desktop, game-room-sync"
                value={advertisedHostnamesInput}
                onChange={(event) => setAdvertisedHostnamesInput(event.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() =>
                  void syncState.setDesktopAdvertisedHostnames(
                    advertisedHostnamesInput
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  )
                }
                disabled={!syncState.canControlLocalSync || syncState.actionPending}
                className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Save hostnames
              </Button>
            </div>
            <div className="grid gap-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Shareable `.local` URLs</p>
              {shareablePeers.length > 0 ? (
                shareablePeers.map((peer) => (
                  <div
                    key={peer.id}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-600"
                  >
                    <p className="font-medium text-slate-700">{peer.label}</p>
                    <p className="break-all font-mono text-slate-500">{peer.peer}</p>
                    {peer.note ? <p>{peer.note}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No advertised `.local` URLs configured yet.</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void syncState.startLocalSync()}
                disabled={!syncState.canControlLocalSync || syncState.actionPending || syncState.desktopStatus?.running}
              >
                Start local sync
              </Button>
              <Button
                type="button"
                onClick={() => void syncState.stopLocalSync()}
                disabled={!syncState.canControlLocalSync || syncState.actionPending || !syncState.desktopStatus?.running}
                className="bg-slate-700 hover:bg-slate-800"
              >
                Stop local sync
              </Button>
              <Button
                type="button"
                onClick={() => void syncState.refreshDesktopStatus()}
                disabled={!syncState.canControlLocalSync || syncState.actionPending}
                className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                Refresh
              </Button>
            </div>
            {syncState.actionError ? <p className="text-red-700">{syncState.actionError}</p> : null}
          </div>
        ) : null}
        {account?.$isLoaded ? (
          <p className="break-all font-mono text-[10px] text-slate-500">
            Account <span className="text-slate-700">{account.$jazz.id}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
