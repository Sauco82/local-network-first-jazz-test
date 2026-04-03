import { useMemo, type ReactNode } from "react";
import { assertLoaded, getLoadedOrUndefined, resolveJazzApiKey, useDeviceAccount } from "@repo/jazz";
import { AppShell, Badge, Card } from "@repo/ui";
import { CreateSharedUserDataPrompt } from "./components/CreateSharedUserDataPrompt";
import { DeviceNameSection } from "./components/DeviceNameSection";
import { DevicesListSection } from "./components/DevicesListSection";
import { EnsureCurrentDeviceInSharedList } from "./components/EnsureCurrentDeviceInSharedList";
import { GamesSection } from "./components/GamesSection";
import { GroupNameSection } from "./components/GroupNameSection";
import { InviteSection } from "./components/InviteSection";
import { JazzConfigCard } from "./components/JazzConfigCard";
import { JoinInviteSection } from "./components/JoinInviteSection";
import type { AppRuntime } from "./runtime";
import type { SyncSettingsState } from "./useSyncSettings";

function UserDevicesWorkspaceLayout({
  apiKey,
  runtime,
  syncState,
  statusTone,
  statusLabel,
  mainContent,
  account,
}: {
  apiKey?: string;
  runtime: AppRuntime;
  syncState: SyncSettingsState;
  statusTone: "success" | "warning";
  statusLabel: string;
  mainContent: ReactNode;
  account?: ReturnType<typeof useDeviceAccount>;
}) {
  const effectiveApiKey = useMemo(() => resolveJazzApiKey(apiKey), [apiKey]);
  const runtimeLabel = runtime === "desktop" ? "Desktop" : "Web";

  return (
    <AppShell
      eyebrow="Local-first user"
      title="Shared user data across your devices."
      subtitle="Create or join a Jazz group, link devices, and invite others. Sync can switch between cloud, hardcoded LAN, and an Electron-hosted prototype server."
    >
      <section className="grid gap-3 md:grid-cols-[1fr_minmax(200px,280px)]">
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{runtimeLabel}</Badge>
            <Badge tone={statusTone}>{statusLabel}</Badge>
          </div>

          <div className="mt-3 grid gap-3">{mainContent}</div>
        </Card>

        <div className="min-w-0">
          <JazzConfigCard
            effectiveApiKey={effectiveApiKey}
            account={account}
            syncState={syncState}
          />
        </div>
      </section>
    </AppShell>
  );
}

export function UserDevicesWorkspace({
  apiKey,
  runtime,
  syncState,
}: {
  apiKey?: string;
  runtime: AppRuntime;
  syncState: SyncSettingsState;
}) {
  const account = useDeviceAccount();

  const shared = useMemo(() => {
    if (!account.$isLoaded) {
      return undefined;
    }
    assertLoaded(account);
    const root = getLoadedOrUndefined(account.root);
    if (!root) {
      return undefined;
    }
    return root.userData;
  }, [account]);

  return (
    <UserDevicesWorkspaceLayout
      apiKey={apiKey}
      runtime={runtime}
      syncState={syncState}
      statusTone={account.$isLoaded ? "success" : "warning"}
      statusLabel={account.$isLoaded ? "Ready" : "Loading"}
      account={account}
      mainContent={
        !account.$isLoaded ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
            Bootstrapping your Jazz account…
          </div>
        ) : (
          <>
            <DeviceNameSection key={account.$jazz.id} account={account} runtime={runtime} />

            {!shared ? <CreateSharedUserDataPrompt account={account} runtime={runtime} /> : null}

            {shared ? (
              <>
                <EnsureCurrentDeviceInSharedList shared={shared} />
                <GroupNameSection key={shared.$jazz.id} shared={shared} runtime={runtime} />
                <DevicesListSection account={account} shared={shared} />
                <GamesSection shared={shared} />
              </>
            ) : null}

            <div className="grid gap-2">
              <InviteSection shared={shared} />
              <JoinInviteSection account={account} />
            </div>
          </>
        )
      }
    />
  );
}

export function UserDevicesWorkspaceLoading({
  apiKey,
  runtime,
  syncState,
}: {
  apiKey?: string;
  runtime: AppRuntime;
  syncState: SyncSettingsState;
}) {
  const detail = syncState.actionError ?? syncState.resolvedPeer.warning ?? syncState.resolvedPeer.detail;

  return (
    <UserDevicesWorkspaceLayout
      apiKey={apiKey}
      runtime={runtime}
      syncState={syncState}
      statusTone="warning"
      statusLabel="Loading"
      mainContent={
        <div className="grid gap-3">
          <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-3 text-[11px] text-slate-600">
            {syncState.isResolvingPeer
              ? "Resolving sync target before mounting Jazz…"
              : "Waiting for a reachable sync target before mounting Jazz…"}
          </div>
          <div className="min-h-40 rounded-md border border-dashed border-slate-200 bg-white/70 px-2.5 py-3 text-[11px] text-slate-500">
            {detail}
          </div>
        </div>
      }
    />
  );
}
