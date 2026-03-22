import { useState } from "react";
import { assertLoaded, getLoadedOrUndefined, type DeviceAccountFromHook } from "@repo/jazz";
import { Button, TextField } from "@repo/ui";
import { defaultUserLabel, type AppRuntime } from "../runtime";

export function DeviceNameSection({
  account,
  runtime,
}: {
  account: DeviceAccountFromHook;
  runtime: AppRuntime;
}) {
  assertLoaded(account);
  const profile = getLoadedOrUndefined(account.profile);
  const remote = profile?.name?.trim();
  const fallback = defaultUserLabel(runtime);
  const [local, setLocal] = useState<string | null>(null);
  const value = local !== null ? local : remote && remote.length > 0 ? remote : fallback;

  const handleSave = () => {
    if (!profile) {
      return;
    }
    profile.$jazz.set("name", value.trim());
    setLocal(null);
  };

  return (
    <div className="space-y-1.5">
      <div>
        <h2 className="text-xs font-semibold text-slate-900">This device</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Shown in the device list. Defaults from this environment.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <TextField
            value={value}
            placeholder={fallback}
            onChange={(event) => setLocal(event.target.value)}
          />
        </div>
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
}
