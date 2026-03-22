import { useCallback, useMemo, useState } from "react";
import { createInviteLink, getLoadedOrUndefined } from "@repo/jazz";
import type { AccountRole } from "@repo/jazz";
import type { SharedUserData } from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { Button } from "@repo/ui";
import { CompactDisclosure } from "./CompactDisclosure";
import { INVITE_ROLES, INVITE_VALUE_HINT, inviteBaseUrl } from "../runtime";

type LoadedShared = Loaded<typeof SharedUserData>;

export function InviteSection({ shared }: { shared: LoadedShared | undefined }) {
  const [open, setOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<AccountRole>("writer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  /** `root.userData` can be a not-yet-loaded ref even when present; `createInviteLink` needs a loaded value. */
  const loadedShared = useMemo((): LoadedShared | undefined => {
    if (shared === undefined) {
      return undefined;
    }
    return getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
  }, [shared]);

  const handleGenerateInvite = useCallback(() => {
    setInviteLink(null);
    setCopied(false);
    setInviteError(null);
    if (!loadedShared) {
      return;
    }
    try {
      const link = createInviteLink(loadedShared, inviteRole, inviteBaseUrl(), INVITE_VALUE_HINT);
      setInviteLink(link);
    } catch (err) {
      setInviteLink(null);
      setInviteError(err instanceof Error ? err.message : "Could not generate invite link.");
    }
  }, [inviteRole, loadedShared]);

  const handleCopyInvite = useCallback(async () => {
    if (!inviteLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [inviteLink]);

  const hint = !shared
    ? "Create or join shared data first"
    : !loadedShared
      ? "Loading shared data…"
      : inviteLink
        ? "Link ready"
        : undefined;

  return (
    <CompactDisclosure
      id="invite"
      title="Create invite"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      hintWhenCollapsed={hint}
      badge={
        inviteLink && !open ? (
          <span className="rounded bg-sky-100 px-1.5 py-0 text-[10px] font-medium text-sky-800">Ready</span>
        ) : null
      }
    >
      <div className="space-y-2 text-xs text-slate-600">
        {!shared ? (
          <p className="text-[11px] leading-snug text-amber-800">You need shared user data before you can invite.</p>
        ) : (
          <>
            <p className="text-[11px] leading-snug text-slate-500">
              Choose a role, generate a link, then open it on another device (or paste it in Join below).
            </p>
            {shared && !loadedShared ? (
              <p className="text-[11px] leading-snug text-slate-500">Loading shared data…</p>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5 text-[10px] font-medium text-slate-600">
                Role
                <select
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                  value={inviteRole}
                  onChange={(event) => {
                    setInviteRole(event.target.value as AccountRole);
                    setInviteError(null);
                  }}
                >
                  {INVITE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="button" className="shrink-0" onClick={handleGenerateInvite} disabled={!loadedShared}>
                Generate link
              </Button>
              <Button type="button" className="shrink-0" onClick={handleCopyInvite} disabled={!inviteLink}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            {inviteError ? (
              <p className="text-[11px] leading-snug text-red-700" role="alert">
                {inviteError}
              </p>
            ) : null}
            {inviteLink ? (
              <div className="space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Invite URL</p>
                <p className="break-all rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] leading-relaxed text-slate-700">
                  {inviteLink}
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-slate-400">Generate to see the URL.</p>
            )}
          </>
        )}
      </div>
    </CompactDisclosure>
  );
}
