import type { DeviceAccountFromHook } from "@repo/jazz";
import { Button, Card } from "@repo/ui";
import { buildSyncModeOptionLabel, SYNC_MODE_OPTIONS, syncTargetLabel } from "../runtime";
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
  const localDesktopOption = syncState.optionStates["local-desktop"];
  const localStatusText =
    syncState.desktopStatus?.running
      ? `Server process running on ${syncState.desktopStatus.peer}`
      : syncState.desktopStatus?.error
        ? `Server process stopped (${syncState.desktopStatus.error})`
        : "Server process stopped";

  const localAvailabilityText =
    localDesktopOption.availability === "available"
      ? "Sync endpoint reachable"
      : localDesktopOption.availability === "checking"
        ? "Checking endpoint availability…"
        : localDesktopOption.availability === "unavailable"
          ? "Sync endpoint unavailable"
          : "Sync endpoint not configured";

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
            Sync mode
            <select
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
              value={syncState.mode}
              onChange={(event) => syncState.setMode(event.target.value as (typeof syncState)["mode"])}
            >
              {SYNC_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {buildSyncModeOptionLabel(option.value, syncState.optionStates)}
                </option>
              ))}
            </select>
          </label>
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
                ? "No reachable sync peer"
                : syncTargetLabel(syncState.resolvedPeer.activeSource)}
            </span>
          </p>
          <p>{syncState.resolvedPeer.detail}</p>
          {syncState.resolvedPeer.warning ? (
            <p className="text-amber-800">{syncState.resolvedPeer.warning}</p>
          ) : null}
          {syncState.isResolvingPeer ? <p className="text-slate-500">Checking sync peer availability…</p> : null}
          <p className="text-slate-500">
            Hardcoded LAN peer:{" "}
            <span className="font-mono text-[10px] text-slate-700">
              {syncState.hardcodedPeer?.trim() || "not configured"}
            </span>
          </p>
        </div>
        {syncState.canControlLocalSync ? (
          <div className="grid gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Local desktop sync</p>
            <p>{localStatusText}</p>
            <p>{localAvailabilityText}</p>
            {localDesktopOption.note ? <p className="text-slate-500">{localDesktopOption.note}</p> : null}
            {syncState.desktopStatus?.dbPath ? (
              <p className="break-all font-mono text-[10px] text-slate-500">{syncState.desktopStatus.dbPath}</p>
            ) : null}
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
