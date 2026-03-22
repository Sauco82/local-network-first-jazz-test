import type { DeviceAccountFromHook } from "@repo/jazz";
import { Card } from "@repo/ui";

export function JazzConfigCard({
  effectiveApiKey,
  account,
}: {
  effectiveApiKey: string;
  account: DeviceAccountFromHook;
}) {
  return (
    <Card>
      <h2 className="text-xs font-semibold text-slate-900">Jazz</h2>
      <div className="mt-2 grid gap-1.5 text-[11px] leading-snug text-slate-600">
        <p>
          API key: <span className="font-mono font-medium text-sky-800">{effectiveApiKey}</span>
        </p>
        <p className="text-slate-500">
          Override via <code className="rounded bg-slate-100 px-0.5 text-[10px]">apps/web/.env</code> →{" "}
          <code className="rounded bg-slate-100 px-0.5 text-[10px]">VITE_JAZZ_API_KEY</code>
        </p>
        {account.$isLoaded ? (
          <p className="break-all font-mono text-[10px] text-slate-500">
            Account <span className="text-slate-700">{account.$jazz.id}</span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
