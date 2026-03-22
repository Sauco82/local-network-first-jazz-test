import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Account,
  assertLoaded,
  createInviteLink,
  getLoadedOrUndefined,
  Group,
  JazzAppProvider,
  parseInviteLink,
  resolveJazzApiKey,
  SharedUserData,
  useDeviceAccount,
} from "@repo/jazz";
import type { AccountRole } from "@repo/jazz";
import { AppShell, Badge, Button, Card, TextField } from "@repo/ui";

const INVITE_VALUE_HINT = "userData";

const INVITE_ROLES: AccountRole[] = ["reader", "writer", "manager", "admin", "writeOnly"];

type AppRuntime = "web" | "desktop";

function defaultUserLabel(runtime: AppRuntime): string {
  if (typeof window !== "undefined" && window.desktopShell?.hostname) {
    return window.desktopShell.hostname;
  }
  if (typeof window !== "undefined" && window.location.hostname) {
    return `${window.location.hostname} (browser)`;
  }
  return runtime === "desktop" ? "Desktop" : "Browser";
}

function inviteBaseUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function App({ apiKey, runtime }: { apiKey?: string; runtime: AppRuntime }) {
  return (
    <JazzAppProvider apiKey={apiKey}>
      <UserDevicesWorkspace apiKey={apiKey} runtime={runtime} />
    </JazzAppProvider>
  );
}

function UserDevicesWorkspace({
  apiKey,
  runtime,
}: {
  apiKey?: string;
  runtime: AppRuntime;
}) {
  const account = useDeviceAccount();
  const [inviteRole, setInviteRole] = useState<AccountRole>("writer");
  const [joinUrl, setJoinUrl] = useState("");
  const [joinMessage, setJoinMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(() => defaultUserLabel(runtime));
  const [deviceNameDraft, setDeviceNameDraft] = useState(() => defaultUserLabel(runtime));

  const runtimeLabel = runtime === "desktop" ? "Electron desktop" : "Vite web";
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

  const sharedUserDataId = useMemo(() => {
    if (!account.$isLoaded) {
      return undefined;
    }
    assertLoaded(account);
    const root = getLoadedOrUndefined(account.root);
    return root?.userData?.$jazz.id;
  }, [account]);

  useEffect(() => {
    if (shared?.name !== undefined && shared.name.trim() !== "") {
      setNameDraft(shared.name);
    } else if (!shared) {
      setNameDraft(defaultUserLabel(runtime));
    }
  }, [shared, shared?.name, runtime]);

  useEffect(() => {
    if (!account.$isLoaded) {
      return;
    }
    assertLoaded(account);
    const profile = getLoadedOrUndefined(account.profile);
    if (profile?.name !== undefined) {
      setDeviceNameDraft(profile.name);
    }
  }, [account, account.$isLoaded]);

  useEffect(() => {
    if (!account.$isLoaded) {
      return;
    }
    assertLoaded(account);
    const root = getLoadedOrUndefined(account.root);
    if (!root?.userData) {
      return;
    }

    const me = Account.getMe();
    const userData = root.userData;
    assertLoaded(userData);
    assertLoaded(userData.devices);
    const already = userData.devices
      .slice()
      .some((device) => device.$jazz.id === me.$jazz.id);
    if (!already) {
      userData.devices.$jazz.push(me as (typeof userData.devices)[number]);
    }
  }, [account, account.$isLoaded, sharedUserDataId]);

  useEffect(() => {
    const href = window.location.href;
    if (href.includes("#/invite/")) {
      setJoinUrl(href);
    }
  }, []);

  const handleSaveName = useCallback(() => {
    const next = nameDraft.trim();
    if (!shared || next.length === 0) {
      return;
    }
    shared.$jazz.set("name", next);
  }, [nameDraft, shared]);

  const handleSaveDeviceName = useCallback(() => {
    if (!account.$isLoaded) {
      return;
    }
    assertLoaded(account);
    const profile = getLoadedOrUndefined(account.profile);
    if (!profile) {
      return;
    }
    profile.$jazz.set("name", deviceNameDraft.trim());
  }, [account, deviceNameDraft]);

  const handleCreateSharedUserData = useCallback(() => {
    if (!account.$isLoaded) {
      return;
    }
    assertLoaded(account);
    const root = getLoadedOrUndefined(account.root);
    if (!root || root.userData) {
      return;
    }
    const me = Account.getMe();
    const group = Group.create({ owner: me });
    const sharedMap = SharedUserData.create(
      {
        name: defaultUserLabel(runtime),
        devices: [me],
        games: [],
      },
      { owner: group },
    );
    root.$jazz.set("userData", sharedMap);
  }, [account, runtime]);

  const handleLeaveSharedUserData = useCallback(() => {
    if (!account.$isLoaded || !shared) {
      return;
    }
    assertLoaded(account);
    const root = getLoadedOrUndefined(account.root);
    if (!root?.userData) {
      return;
    }
    const me = Account.getMe();
    assertLoaded(shared.devices);
    const devices = shared.devices.slice();
    const index = devices.findIndex((device) => device.$jazz.id === me.$jazz.id);
    if (index !== -1) {
      shared.devices.$jazz.splice(index, 1);
    }
    root.$jazz.set("userData", undefined);
  }, [account, shared]);

  const handleGenerateInvite = useCallback(() => {
    setInviteLink(null);
    if (!shared) {
      return;
    }
    try {
      const link = createInviteLink(shared, inviteRole, inviteBaseUrl(), INVITE_VALUE_HINT);
      setInviteLink(link);
    } catch {
      setInviteLink(null);
    }
  }, [inviteRole, shared]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      // ignore
    }
  }, [inviteLink]);

  const handleJoin = useCallback(async () => {
    setJoinMessage(null);
    const trimmed = joinUrl.trim();
    if (trimmed.length === 0) {
      setJoinMessage("Paste an invite URL first.");
      return;
    }

    const parsed = parseInviteLink(trimmed);
    if (!parsed) {
      setJoinMessage("That URL does not look like a Jazz invite link.");
      return;
    }

    if (parsed.valueHint !== undefined && parsed.valueHint !== INVITE_VALUE_HINT) {
      setJoinMessage("This invite is not for shared user data.");
      return;
    }

    try {
      if (!account.$isLoaded) {
        setJoinMessage("Account not ready.");
        return;
      }
      assertLoaded(account);

      const me = Account.getMe();
      const loadedRaw = await me.acceptInvite(parsed.valueID, parsed.inviteSecret, SharedUserData);
      if (!loadedRaw.$isLoaded) {
        setJoinMessage("Could not load invited user data.");
        return;
      }
      assertLoaded(loadedRaw);

      const rootMap = getLoadedOrUndefined(account.root);
      if (!rootMap) {
        setJoinMessage("Account root not ready.");
        return;
      }
      rootMap.$jazz.set(
        "userData",
        loadedRaw as NonNullable<typeof rootMap.userData>,
      );

      assertLoaded(loadedRaw.devices);
      const already = loadedRaw.devices
        .slice()
        .some((device) => device.$jazz.id === me.$jazz.id);
      if (!already) {
        loadedRaw.devices.$jazz.push(me as (typeof loadedRaw.devices)[number]);
      }
      setJoinMessage("Joined. This device is now using the shared user data.");
    } catch (err) {
      setJoinMessage(err instanceof Error ? err.message : "Could not accept invite.");
    }
  }, [account, joinUrl]);

  return (
    <AppShell
      eyebrow="Local-first user"
      title="Shared user data across your devices."
      subtitle="Create or join a Jazz group for your account, link devices, and invite others with a role-based link. Sync uses the configured Jazz cloud peer."
    >
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{runtimeLabel}</Badge>
            <Badge tone={account.$isLoaded ? "success" : "warning"}>
              {account.$isLoaded ? "Jazz account ready" : "Loading Jazz account"}
            </Badge>
          </div>

          {!account.$isLoaded ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              Bootstrapping your Jazz account and syncing context.
            </div>
          ) : (
            <div className="mt-6 grid gap-6">
              <div>
                <h2 className="text-lg font-semibold text-white">This device</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Display name for this device (shown in the device list when set). Defaults from this environment.
                </p>
                <div className="mt-3 flex flex-wrap gap-3 md:flex-row md:items-end">
                  <div className="min-w-[200px] flex-1">
                    <TextField
                      value={deviceNameDraft}
                      placeholder={defaultUserLabel(runtime)}
                      onChange={(event) => setDeviceNameDraft(event.target.value)}
                    />
                  </div>
                  <Button type="button" onClick={handleSaveDeviceName}>
                    Save device name
                  </Button>
                </div>
              </div>

              {!shared ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <h2 className="text-lg font-semibold text-white">Shared user data</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Create a new shared space for this account, or join one below with an invite link.
                  </p>
                  <div className="mt-3">
                    <Button type="button" onClick={handleCreateSharedUserData}>
                      Create shared user data
                    </Button>
                  </div>
                </div>
              ) : null}

              {shared ? (
                <div>
                  <h2 className="text-lg font-semibold text-white">User / group</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Name for this group of devices (default comes from the machine or browser host).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 md:flex-row md:items-end">
                    <div className="min-w-[200px] flex-1">
                      <TextField
                        value={nameDraft}
                        placeholder={defaultUserLabel(runtime)}
                        onChange={(event) => setNameDraft(event.target.value)}
                      />
                    </div>
                    <Button type="button" onClick={handleSaveName} disabled={nameDraft.trim().length === 0}>
                      Save name
                    </Button>
                  </div>
                </div>
              ) : null}

              {shared ? (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">Devices</h2>
                      <p className="mt-1 text-sm text-slate-400">Device accounts linked to this shared user.</p>
                    </div>
                    <Button
                      type="button"
                      className="border border-red-400/40 bg-red-950/80 text-red-100 hover:bg-red-900/90"
                      onClick={handleLeaveSharedUserData}
                    >
                      Leave shared user data
                    </Button>
                  </div>
                  <ul className="mt-3 grid gap-2">
                    {shared.devices.slice().length === 0 ? (
                      <li className="text-sm text-slate-500">No devices yet.</li>
                    ) : (
                      shared.devices.slice().map((device) => {
                        const profile = getLoadedOrUndefined(device.profile);
                        const trimmed = profile?.name?.trim();
                        const label = trimmed && trimmed.length > 0 ? trimmed : device.$jazz.id;
                        const idFallback = !trimmed || trimmed.length === 0;
                        return (
                          <li
                            key={device.$jazz.id}
                            className="rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-xs text-slate-300"
                          >
                            <span className={idFallback ? "font-mono" : "font-medium"}>{label}</span>
                            {!idFallback ? (
                              <span className="mt-1 block font-mono text-[10px] text-slate-500">{device.$jazz.id}</span>
                            ) : null}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="border-t border-white/10 pt-6">
                <h2 className="text-lg font-semibold text-white">Invite another device</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Pick a role for the invitee, generate a link, then open it on the other device and use Join
                  below (or use the same link here to attach this account).
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="text-sm text-slate-400">
                    Role{" "}
                    <select
                      className="ml-2 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100"
                      value={inviteRole}
                      onChange={(event) => setInviteRole(event.target.value as AccountRole)}
                    >
                      {INVITE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button type="button" onClick={handleGenerateInvite} disabled={!shared}>
                    Create invite link
                  </Button>
                  <Button type="button" onClick={handleCopyInvite} disabled={!inviteLink}>
                    Copy link
                  </Button>
                </div>
                {inviteLink ? (
                  <p className="mt-3 break-all rounded-2xl border border-white/10 bg-slate-900/50 px-3 py-2 font-mono text-xs text-slate-300">
                    {inviteLink}
                  </p>
                ) : null}
              </div>

              <div className="border-t border-white/10 pt-6">
                <h2 className="text-lg font-semibold text-white">Join with invite link</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Paste a full invite URL (including <code className="text-cyan-200">#/invite/...</code>). If you
                  opened this app from an invite, the field may already be filled.
                </p>
                <textarea
                  className="mt-3 w-full min-h-[88px] rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
                  placeholder="https://…#/invite/userData/…"
                  value={joinUrl}
                  onChange={(event) => setJoinUrl(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button type="button" onClick={handleJoin}>
                    Join shared user data
                  </Button>
                </div>
                {joinMessage ? (
                  <p className="mt-3 text-sm text-slate-300" role="status">
                    {joinMessage}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </Card>

        <div className="grid gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-white">Jazz configuration</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>
                Current key: <span className="font-medium text-cyan-200">{effectiveApiKey}</span>
              </p>
              <p>
                Put your own value in <code>apps/web/.env</code> as <code>VITE_JAZZ_API_KEY</code> to replace the
                starter fallback.
              </p>
              {account.$isLoaded ? (
                <p>
                  Account id:{" "}
                  <span className="break-all font-mono text-xs text-slate-400">{account.$jazz.id}</span>
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
