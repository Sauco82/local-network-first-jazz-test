import { useCallback, useMemo, useState } from "react";
import {
  assertLoaded,
  createInviteLink,
  GameData,
  getLoadedOrUndefined,
  type SharedUserData,
} from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { Button } from "@repo/ui";
import { CompactDisclosure } from "./CompactDisclosure";
import { INVITE_GAME_HINT, inviteBaseUrl } from "../runtime";

type LoadedShared = Loaded<typeof SharedUserData>;

const EMPTY_BOARD: [
  [number, number, number],
  [number, number, number],
  [number, number, number],
] = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
];

export function GamesSection({ shared }: { shared: LoadedShared }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");
  const [createError, setCreateError] = useState<string | null>(null);
  const [inviteByGameId, setInviteByGameId] = useState<Record<string, string | null>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadedShared = useMemo((): LoadedShared | undefined => {
    return getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
  }, [shared]);

  const handleCreateGame = useCallback(() => {
    setCreateError(null);
    if (!loadedShared) {
      return;
    }
    const ownerGroup = loadedShared.$jazz.owner;
    if (!ownerGroup) {
      setCreateError("Shared data has no owner group.");
      return;
    }
    assertLoaded(loadedShared.games);
    const game = GameData.create(
      {
        board: EMPTY_BOARD,
        currentPlayer: "left",
        gameState: "waiting",
        ...(side === "left" ? { leftPlayer: ownerGroup } : { rightPlayer: ownerGroup }),
      },
      { owner: ownerGroup },
    );
    loadedShared.games.$jazz.push(game);
  }, [loadedShared, side]);

  const handleGenerateGameInvite = useCallback(
    (gameId: string) => {
      setInviteByGameId((prev) => ({ ...prev, [gameId]: null }));
      if (!loadedShared) {
        return;
      }
      assertLoaded(loadedShared.games);
      const game = loadedShared.games.slice().find((g) => g.$jazz.id === gameId);
      if (!game) {
        return;
      }
      const loadedGame = getLoadedOrUndefined(game as never) as Loaded<typeof GameData> | undefined;
      if (!loadedGame) {
        setInviteByGameId((prev) => ({
          ...prev,
          [gameId]: null,
        }));
        return;
      }
      try {
        const link = createInviteLink(loadedGame, "writer", inviteBaseUrl(), INVITE_GAME_HINT);
        setInviteByGameId((prev) => ({ ...prev, [gameId]: link }));
      } catch {
        setInviteByGameId((prev) => ({
          ...prev,
          [gameId]: null,
        }));
      }
    },
    [loadedShared],
  );

  const handleCopyGameInvite = useCallback(async (gameId: string) => {
    const inviteLink = inviteByGameId[gameId];
    if (!inviteLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopiedId(gameId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }, [inviteByGameId]);

  assertLoaded(shared);
  assertLoaded(shared.games);
  const games = shared.games.slice();

  return (
    <CompactDisclosure
      id="games"
      title="Games"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      hintWhenCollapsed={games.length > 0 ? `${games.length} game(s)` : undefined}
    >
      <div className="space-y-3 text-xs text-slate-600">
        <p className="text-[11px] leading-snug text-slate-500">
          Create a game for this group, then share an invite so another shared user can join as the other side.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <fieldset className="min-w-0 space-y-1">
            <legend className="text-[10px] font-medium text-slate-600">This group plays as</legend>
            <div className="flex flex-wrap gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                <input
                  type="radio"
                  name="game-side"
                  checked={side === "left"}
                  onChange={() => setSide("left")}
                />
                Left
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px]">
                <input
                  type="radio"
                  name="game-side"
                  checked={side === "right"}
                  onChange={() => setSide("right")}
                />
                Right
              </label>
            </div>
          </fieldset>
          <Button type="button" className="shrink-0" onClick={handleCreateGame} disabled={!loadedShared}>
            New game
          </Button>
        </div>
        {createError ? (
          <p className="text-[11px] text-red-700" role="alert">
            {createError}
          </p>
        ) : null}

        {games.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Your games</p>
            <ul className="space-y-2">
              {games.map((g, index) => {
                const id = g.$jazz.id;
                const loadedG = getLoadedOrUndefined(g as never) as Loaded<typeof GameData> | undefined;
                const stateLabel = loadedG?.gameState ?? "…";
                const inviteLink = inviteByGameId[id];
                return (
                  <li
                    key={id}
                    className="rounded border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-[11px]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="font-mono text-[10px] text-slate-700">
                        #{index + 1} · {stateLabel}
                      </span>
                      <span className="max-w-[180px] truncate font-mono text-[9px] text-slate-400" title={id}>
                        {id}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      <Button type="button" className="shrink-0 text-[10px]" onClick={() => handleGenerateGameInvite(id)}>
                        Generate invite
                      </Button>
                      <Button
                        type="button"
                        className="shrink-0 text-[10px]"
                        onClick={() => handleCopyGameInvite(id)}
                        disabled={!inviteLink}
                      >
                        {copiedId === id ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    {inviteLink ? (
                      <p className="mt-1 break-all rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-[9px] leading-relaxed text-slate-600">
                        {inviteLink}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-[10px] text-slate-400">No games yet.</p>
        )}
      </div>
    </CompactDisclosure>
  );
}
