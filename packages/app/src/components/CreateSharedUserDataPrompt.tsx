import { useCallback } from "react";
import { Account, assertLoaded, getLoadedOrUndefined, Group, SharedUserData } from "@repo/jazz";
import type { DeviceAccountFromHook } from "@repo/jazz";
import { Button } from "@repo/ui";
import { defaultUserLabel, type AppRuntime } from "../runtime";

export function CreateSharedUserDataPrompt({
  account,
  runtime,
}: {
  account: DeviceAccountFromHook;
  runtime: AppRuntime;
}) {
  const handleCreate = useCallback(() => {
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

  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50/80 px-2.5 py-2">
      <h2 className="text-xs font-semibold text-slate-900">No shared data yet</h2>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Create a space or join with an invite below.</p>
      <div className="mt-2">
        <Button type="button" onClick={handleCreate}>
          Create shared data
        </Button>
      </div>
    </div>
  );
}
