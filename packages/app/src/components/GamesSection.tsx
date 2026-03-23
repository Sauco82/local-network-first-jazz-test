import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Account,
  assertLoaded,
  CoValueLoadingState,
  deleteCoValues,
  GameData,
  getLoadedOrUndefined,
  Group,
  loadCoValue,
  type SharedUserData,
} from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { Button } from "@repo/ui";
import { EMPTY_BOARD } from "../game/board";
import { parseGuestGroupIdFromPayload } from "../game/joinGuest";
import { CompactDisclosure } from "./CompactDisclosure";
import { inviteBaseUrl } from "../runtime";

type LoadedShared = Loaded<typeof SharedUserData>;

type StaleCounts = {
  deleted: number;
  unauthorized: number;
  unavailable: number;
  loading: number;
};

/** List refs from `co.list` — loaded rows or not-loaded stubs with `loadingState`. */
type GameListItem = Loaded<typeof GameData> | { $isLoaded: false; $jazz: { id: string; loadingState: string } };

function partitionGames(list: readonly GameListItem[]): {
  accessible: Loaded<typeof GameData>[];
  stale: StaleCounts;
} {
  const accessible: Loaded<typeof GameData>[] = [];
  const stale: StaleCounts = {
    deleted: 0,
    unauthorized: 0,
    unavailable: 0,
    loading: 0,
  };
  for (const g of list) {
    if (g.$isLoaded) {
      accessible.push(g);
      continue;
    }
    const ls = g.$jazz.loadingState;
    if (ls === CoValueLoadingState.DELETED) {
      stale.deleted += 1;
    } else if (ls === CoValueLoadingState.UNAUTHORIZED) {
      stale.unauthorized += 1;
    } else if (ls === CoValueLoadingState.UNAVAILABLE) {
      stale.unavailable += 1;
    } else if (ls === CoValueLoadingState.LOADING) {
      stale.loading += 1;
    } else {
      stale.loading += 1;
    }
  }
  return { accessible, stale };
}

function staleSummaryParts(stale: StaleCounts): string[] {
  const parts: string[] = [];
  if (stale.deleted > 0) {
    parts.push(`deleted(${stale.deleted})`);
  }
  if (stale.unauthorized > 0) {
    parts.push(`non-authorised(${stale.unauthorized})`);
  }
  if (stale.unavailable > 0) {
    parts.push(`unavailable(${stale.unavailable})`);
  }
  if (stale.loading > 0) {
    parts.push(`loading(${stale.loading})`);
  }
  return parts;
}

export function GamesSection({ shared }: { shared: LoadedShared }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"left" | "right">("left");
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedShareId, setCopiedShareId] = useState<string | null>(null);
  const [guestGroupInputByGameId, setGuestGroupInputByGameId] = useState<Record<string, string>>({});
  const [acceptMessageByGameId, setAcceptMessageByGameId] = useState<Record<string, string | null>>({});

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
    const me = Account.getMe();
    const gameAcl = Group.create({ owner: me });
    gameAcl.addMember(ownerGroup, "writer");
    const game = GameData.create(
      {
        board: EMPTY_BOARD,
        currentPlayer: "left",
        gameState: "waiting",
        ...(side === "left" ? { leftPlayer: ownerGroup } : { rightPlayer: ownerGroup }),
      },
      { owner: gameAcl },
    );
    loadedShared.games.$jazz.push(game);
  }, [loadedShared, side]);

  const shareLinkForGame = useCallback((gameId: string) => {
    return `${inviteBaseUrl()}#/game/${gameId}`;
  }, []);

  const handleCopyShareLink = useCallback(
    async (gameId: string) => {
      try {
        await navigator.clipboard.writeText(shareLinkForGame(gameId));
        setCopiedShareId(gameId);
        window.setTimeout(() => setCopiedShareId(null), 2000);
      } catch {
        // ignore
      }
    },
    [shareLinkForGame],
  );

  const handleAcceptGuestGroup = useCallback(
    async (gameId: string) => {
      setAcceptMessageByGameId((prev) => ({ ...prev, [gameId]: null }));
      const raw = guestGroupInputByGameId[gameId]?.trim() ?? "";
      if (!loadedShared || raw.length === 0) {
        setAcceptMessageByGameId((prev) => ({
          ...prev,
          [gameId]: "Paste the guest user group id (or full join payload) first.",
        }));
        return;
      }
      assertLoaded(loadedShared.games);
      const game = loadedShared.games.slice().find((g) => g.$jazz.id === gameId);
      if (!game) {
        return;
      }
      const loadedGame = getLoadedOrUndefined(game as never) as Loaded<typeof GameData> | undefined;
      if (!loadedGame?.$isLoaded) {
        setAcceptMessageByGameId((prev) => ({
          ...prev,
          [gameId]: "Load this game first (wait for sync).",
        }));
        return;
      }
      assertLoaded(loadedGame);
      const guestId = parseGuestGroupIdFromPayload(raw);
      if (!guestId) {
        setAcceptMessageByGameId((prev) => ({
          ...prev,
          [gameId]: "Could not read a group id from that paste.",
        }));
        return;
      }
      try {
        const guestGroup = await loadCoValue(Group, guestId, { loadAs: Account.getMe() });
        if (!guestGroup.$isLoaded) {
          setAcceptMessageByGameId((prev) => ({
            ...prev,
            [gameId]: "Could not load that group id.",
          }));
          return;
        }
        assertLoaded(guestGroup);
        loadedGame.$jazz.owner.addMember(guestGroup, "writer");
        setAcceptMessageByGameId((prev) => ({
          ...prev,
          [gameId]: "Guest user group can now load this game.",
        }));
        setGuestGroupInputByGameId((prev) => ({ ...prev, [gameId]: "" }));
      } catch (e) {
        setAcceptMessageByGameId((prev) => ({
          ...prev,
          [gameId]: e instanceof Error ? e.message : "Could not add guest group.",
        }));
      }
    },
    [loadedShared, guestGroupInputByGameId],
  );

  const handleDeleteGame = useCallback(
    async (gameId: string) => {
      assertLoaded(shared);
      assertLoaded(shared.games);
      const games = shared.games.slice();
      const index = games.findIndex((g) => g.$jazz.id === gameId);
      if (index === -1) {
        return;
      }
      try {
        await deleteCoValues(GameData, gameId, {
          resolve: {
            leftPlayer: true,
            rightPlayer: true,
          },
        });
      } catch (e) {
        console.error("Failed to delete game CoValue", e);
        return;
      }
      shared.games.$jazz.splice(index, 1);
      setGuestGroupInputByGameId((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
      setAcceptMessageByGameId((prev) => {
        const next = { ...prev };
        delete next[gameId];
        return next;
      });
    },
    [shared],
  );

  const handleRemoveDeletedRefsFromList = useCallback(() => {
    assertLoaded(shared);
    assertLoaded(shared.games);
    const list = shared.games.slice() as GameListItem[];
    const removedIds: string[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const g = list[i];
      if (!g.$isLoaded && g.$jazz.loadingState === CoValueLoadingState.DELETED) {
        removedIds.push(g.$jazz.id);
        shared.games.$jazz.splice(i, 1);
      }
    }
    if (removedIds.length > 0) {
      setGuestGroupInputByGameId((prev) => {
        const next = { ...prev };
        for (const id of removedIds) {
          delete next[id];
        }
        return next;
      });
      setAcceptMessageByGameId((prev) => {
        const next = { ...prev };
        for (const id of removedIds) {
          delete next[id];
        }
        return next;
      });
    }
  }, [shared]);

  assertLoaded(shared);
  assertLoaded(shared.games);
  const games = shared.games.slice() as GameListItem[];
  const { accessible, stale } = partitionGames(games);
  const totalListed = games.length;
  const staleParts = staleSummaryParts(stale);
  const hasStale = staleParts.length > 0;

  const collapsedHint = (() => {
    if (accessible.length > 0) {
      return `${accessible.length} game(s)`;
    }
    if (totalListed > 0) {
      return `${totalListed} in list`;
    }
    return undefined;
  })();

  return (
    <CompactDisclosure
      id="games"
      title="Games"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      hintWhenCollapsed={collapsedHint}
    >
      <div className="space-y-3 text-xs text-slate-600">
        <p className="text-[11px] leading-snug text-slate-500">
          Create a game for this group, copy the share link for the other player, then paste their{" "}
          <span className="font-medium text-slate-700">user group id</span> when they send a join request.
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

        {hasStale ? (
          <div className="space-y-1.5 rounded border border-amber-200/80 bg-amber-50/90 px-2 py-1.5 text-[11px] text-amber-950">
            <p className="text-[10px] leading-snug text-amber-900/90">
              <span className="font-medium">Not shown in the list below:</span> {staleParts.join(" · ")}
            </p>
            {stale.deleted > 0 ? (
              <Button
                type="button"
                className="border border-amber-300 bg-white text-[10px] text-amber-950 hover:bg-amber-100/80"
                onClick={handleRemoveDeletedRefsFromList}
              >
                Remove deleted from list
              </Button>
            ) : null}
          </div>
        ) : null}

        {accessible.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Your games</p>
            <ul className="space-y-2">
              {accessible.map((g, index) => {
                const id = g.$jazz.id;
                const stateLabel = g.gameState;
                const shareUrl = shareLinkForGame(id);
                const leftTaken = g.leftPlayer != null;
                const rightTaken = g.rightPlayer != null;
                const needsOpponent = g.gameState === "waiting" && (!leftTaken || !rightTaken);
                const acceptMsg = acceptMessageByGameId[id];
                const guestInput = guestGroupInputByGameId[id] ?? "";
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
                      <Button
                        type="button"
                        className="shrink-0 text-[10px]"
                        onClick={() => navigate(`/game/${id}`)}
                      >
                        Open
                      </Button>
                      <Button type="button" className="shrink-0 text-[10px]" onClick={() => handleCopyShareLink(id)}>
                        {copiedShareId === id ? "Copied link" : "Copy share link"}
                      </Button>
                      <Button
                        type="button"
                        className="shrink-0 border border-red-200 bg-red-50 text-[10px] text-red-800 hover:bg-red-100"
                        onClick={() => handleDeleteGame(id)}
                      >
                        Delete
                      </Button>
                    </div>
                    <p className="mt-1 break-all rounded border border-slate-200 bg-white px-1.5 py-1 font-mono text-[9px] leading-relaxed text-slate-600">
                      {shareUrl}
                    </p>
                    {needsOpponent ? (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] font-medium text-slate-600">Accept join (guest user group id)</p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            className="min-w-[200px] flex-1 rounded border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] text-slate-900 outline-none focus:border-sky-500"
                            placeholder="Paste guest group id or gameId|groupId"
                            value={guestInput}
                            onChange={(e) =>
                              setGuestGroupInputByGameId((prev) => ({ ...prev, [id]: e.target.value }))
                            }
                          />
                          <Button type="button" className="shrink-0 text-[10px]" onClick={() => handleAcceptGuestGroup(id)}>
                            Add guest group
                          </Button>
                        </div>
                        {acceptMsg ? (
                          <p className="text-[10px] text-slate-700" role="status">
                            {acceptMsg}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : totalListed === 0 ? (
          <p className="text-[10px] text-slate-400">No games yet.</p>
        ) : (
          <p className="text-[10px] text-slate-500">
            No playable games in your list. Entries that cannot be opened are summarized above.
          </p>
        )}
      </div>
    </CompactDisclosure>
  );
}
