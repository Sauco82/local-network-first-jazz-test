import { useState } from "react";
import { assertLoaded } from "@repo/jazz";
import type { SharedUserData } from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { Button, TextField } from "@repo/ui";
import { defaultUserLabel, type AppRuntime } from "../runtime";

type LoadedShared = Loaded<typeof SharedUserData>;

export function GroupNameSection({
  shared,
  runtime,
}: {
  shared: LoadedShared;
  runtime: AppRuntime;
}) {
  assertLoaded(shared);
  const fallback = defaultUserLabel(runtime);
  const remote = shared.name?.trim();
  const [local, setLocal] = useState<string | null>(null);
  const value = local !== null ? local : remote && remote.length > 0 ? remote : fallback;

  const handleSave = () => {
    const next = value.trim();
    if (next.length === 0) {
      return;
    }
    shared.$jazz.set("name", next);
    setLocal(null);
  };

  return (
    <div className="space-y-1.5">
      <div>
        <h2 className="text-xs font-semibold text-slate-900">Group name</h2>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">Label for this shared space across devices.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[160px] flex-1">
          <TextField
            value={value}
            placeholder={fallback}
            onChange={(event) => setLocal(event.target.value)}
          />
        </div>
        <Button type="button" onClick={handleSave} disabled={value.trim().length === 0}>
          Save
        </Button>
      </div>
    </div>
  );
}
