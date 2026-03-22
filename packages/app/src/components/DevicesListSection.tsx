import { useCallback } from "react";
import { Account, assertLoaded, getLoadedOrUndefined, type DeviceAccountFromHook } from "@repo/jazz";
import type { SharedUserData } from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { Button } from "@repo/ui";

type LoadedShared = Loaded<typeof SharedUserData>;

export function DevicesListSection({
  account,
  shared,
}: {
  account: DeviceAccountFromHook;
  shared: LoadedShared;
}) {
  const handleLeave = useCallback(() => {
    if (!account.$isLoaded) {
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

  assertLoaded(shared.devices);

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold text-slate-900">Devices</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">Linked to this shared user.</p>
        </div>
        <Button
          type="button"
          className="border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
          onClick={handleLeave}
        >
          Leave
        </Button>
      </div>
      <ul className="grid gap-1">
        {shared.devices.slice().length === 0 ? (
          <li className="text-[11px] text-slate-400">No devices yet.</li>
        ) : (
          shared.devices.slice().map((device) => {
            assertLoaded(device);
            const profile = getLoadedOrUndefined(device.profile);
            const trimmed = profile?.name?.trim();
            const label = trimmed && trimmed.length > 0 ? trimmed : device.$jazz.id;
            const idFallback = !trimmed || trimmed.length === 0;
            return (
              <li
                key={device.$jazz.id}
                className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-700"
              >
                <span className={idFallback ? "font-mono" : "font-medium"}>{label}</span>
                {!idFallback ? (
                  <span className="mt-0.5 block font-mono text-[9px] text-slate-400">{device.$jazz.id}</span>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
