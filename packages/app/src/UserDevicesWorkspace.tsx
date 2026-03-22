import { useMemo } from "react";
import { assertLoaded, getLoadedOrUndefined, resolveJazzApiKey, useDeviceAccount } from "@repo/jazz";
import { AppShell, Badge, Card } from "@repo/ui";
import { CreateSharedUserDataPrompt } from "./components/CreateSharedUserDataPrompt";
import { DeviceNameSection } from "./components/DeviceNameSection";
import { DevicesListSection } from "./components/DevicesListSection";
import { EnsureCurrentDeviceInSharedList } from "./components/EnsureCurrentDeviceInSharedList";
import { GroupNameSection } from "./components/GroupNameSection";
import { InviteSection } from "./components/InviteSection";
import { JazzConfigCard } from "./components/JazzConfigCard";
import { JoinInviteSection } from "./components/JoinInviteSection";
import type { AppRuntime } from "./runtime";

export function UserDevicesWorkspace({
  apiKey,
  runtime,
}: {
  apiKey?: string;
  runtime: AppRuntime;
}) {
  const account = useDeviceAccount();
  const effectiveApiKey = useMemo(() => resolveJazzApiKey(apiKey), [apiKey]);

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

  const runtimeLabel = runtime === "desktop" ? "Desktop" : "Web";

  return (
    <AppShell
      eyebrow="Local-first user"
      title="Shared user data across your devices."
      subtitle="Create or join a Jazz group, link devices, and invite others. Sync uses your Jazz cloud peer."
    >
      <section className="grid gap-3 md:grid-cols-[1fr_minmax(200px,280px)]">
        <Card>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{runtimeLabel}</Badge>
            <Badge tone={account.$isLoaded ? "success" : "warning"}>
              {account.$isLoaded ? "Ready" : "Loading"}
            </Badge>
          </div>

          {!account.$isLoaded ? (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
              Bootstrapping your Jazz account…
            </div>
          ) : (
            <div className="mt-3 grid gap-3">
              <DeviceNameSection key={account.$jazz.id} account={account} runtime={runtime} />

              {!shared ? <CreateSharedUserDataPrompt account={account} runtime={runtime} /> : null}

              {shared ? (
                <>
                  <EnsureCurrentDeviceInSharedList shared={shared} />
                  <GroupNameSection key={shared.$jazz.id} shared={shared} runtime={runtime} />
                  <DevicesListSection account={account} shared={shared} />
                </>
              ) : null}

              <div className="grid gap-2">
                <InviteSection shared={shared} />
                <JoinInviteSection account={account} />
              </div>
            </div>
          )}
        </Card>

        <div className="min-w-0">
          <JazzConfigCard effectiveApiKey={effectiveApiKey} account={account} />
        </div>
      </section>
    </AppShell>
  );
}
