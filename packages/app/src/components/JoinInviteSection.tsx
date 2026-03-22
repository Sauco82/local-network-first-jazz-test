import { useCallback, useState } from "react";
import {
  Account,
  assertLoaded,
  GameData,
  getLoadedOrUndefined,
  parseInviteLink,
  SharedUserData,
  type DeviceAccountFromHook,
} from "@repo/jazz";
import { Button } from "@repo/ui";
import { CompactDisclosure } from "./CompactDisclosure";
import { initialJoinUrlFromLocation, INVITE_GAME_HINT, INVITE_VALUE_HINT } from "../runtime";

export function JoinInviteSection({ account }: { account: DeviceAccountFromHook }) {
  const [open, setOpen] = useState(() => initialJoinUrlFromLocation() !== "");
  const [joinUrl, setJoinUrl] = useState(initialJoinUrlFromLocation);
  const [joinMessage, setJoinMessage] = useState<string | null>(null);

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

    if (
      parsed.valueHint !== undefined &&
      parsed.valueHint !== INVITE_VALUE_HINT &&
      parsed.valueHint !== INVITE_GAME_HINT
    ) {
      setJoinMessage("This invite type is not supported here.");
      return;
    }

    try {
      if (!account.$isLoaded) {
        setJoinMessage("Account not ready.");
        return;
      }
      assertLoaded(account);

      const me = Account.getMe();

      if (parsed.valueHint === INVITE_GAME_HINT) {
        const loadedGame = await me.acceptInvite(parsed.valueID, parsed.inviteSecret, GameData);
        if (!loadedGame.$isLoaded) {
          setJoinMessage("Could not load invited game.");
          return;
        }
        assertLoaded(loadedGame);

        const rootMap = getLoadedOrUndefined(account.root);
        if (!rootMap) {
          setJoinMessage("Account root not ready.");
          return;
        }
        const sharedUser = getLoadedOrUndefined(rootMap.userData);
        if (!sharedUser) {
          setJoinMessage("Create or join shared user data first, then accept the game invite.");
          return;
        }
        assertLoaded(sharedUser);
        const ownerGroup = sharedUser.$jazz.owner;
        if (!ownerGroup) {
          setJoinMessage("Shared user data has no owner group.");
          return;
        }

        const hasLeft = loadedGame.leftPlayer !== undefined && loadedGame.leftPlayer !== null;
        const hasRight = loadedGame.rightPlayer !== undefined && loadedGame.rightPlayer !== null;
        if (hasLeft && hasRight) {
          setJoinMessage("This game already has both players.");
          return;
        }
        if (!hasLeft) {
          loadedGame.$jazz.set("leftPlayer", ownerGroup);
        } else {
          loadedGame.$jazz.set("rightPlayer", ownerGroup);
        }

        assertLoaded(sharedUser.games);
        const alreadyListed = sharedUser.games
          .slice()
          .some((g) => g.$jazz.id === loadedGame.$jazz.id);
        if (!alreadyListed) {
          sharedUser.games.$jazz.push(loadedGame);
        }

        const leftAfter = loadedGame.leftPlayer !== undefined && loadedGame.leftPlayer !== null;
        const rightAfter = loadedGame.rightPlayer !== undefined && loadedGame.rightPlayer !== null;
        if (leftAfter && rightAfter) {
          loadedGame.$jazz.set("gameState", "playing");
        }

        setJoinMessage("Joined the game. Your group is on the open side.");
        return;
      }

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
      rootMap.$jazz.set("userData", loadedRaw as NonNullable<typeof rootMap.userData>);

      assertLoaded(loadedRaw.devices);
      const already = loadedRaw.devices.slice().some((device) => device.$jazz.id === me.$jazz.id);
      if (!already) {
        loadedRaw.devices.$jazz.push(me as (typeof loadedRaw.devices)[number]);
      }
      setJoinMessage("Joined. This device is now using the shared user data.");
    } catch (err) {
      setJoinMessage(err instanceof Error ? err.message : "Could not accept invite.");
    }
  }, [account, joinUrl]);

  const collapsedHint =
    joinUrl.trim().length > 0 ? "URL ready" : open ? undefined : "Expand to paste URL";

  return (
    <CompactDisclosure
      id="join"
      title="Join with invite"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      hintWhenCollapsed={collapsedHint}
    >
      <div className="space-y-2 text-xs text-slate-600">
        <p className="text-[11px] leading-snug text-slate-500">
          Paste the full URL including <code className="rounded bg-slate-100 px-0.5 text-[10px] text-slate-800">#/invite/…</code>
          . If you opened this app from an invite, the field may already be filled.
        </p>
        <textarea
          className="w-full min-h-[72px] rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-[11px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30"
          placeholder="https://…#/invite/userData/… or …/game/…"
          value={joinUrl}
          onChange={(event) => setJoinUrl(event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleJoin}>
            Join
          </Button>
        </div>
        {joinMessage ? (
          <p className="text-[11px] text-slate-700" role="status">
            {joinMessage}
          </p>
        ) : null}
      </div>
    </CompactDisclosure>
  );
}
