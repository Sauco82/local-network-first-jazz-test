import { useCallback, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  assertLoaded,
  deleteCoValues,
  getLoadedOrUndefined,
  GameData,
  useCoState,
  useDeviceAccount,
  type SharedUserData,
} from "@repo/jazz";
import type { Loaded } from "@repo/jazz";
import { AppShell, Badge, Button, Card } from "@repo/ui";
import { CELL_LEFT, CELL_RIGHT, setBoardCell, type Board } from "../game/board";
import { evaluateLineOutcome } from "../game/tictactoe";
import { claimGuestSeatAndListIfNeeded, formatGameJoinPayload } from "../game/joinGuest";
import type { AppRuntime } from "../runtime";

type LoadedShared = Loaded<typeof SharedUserData>;

function resolveMySide(
  ownerId: string,
  game: Loaded<typeof GameData>,
): "left" | "right" | null {
  const lp = game.leftPlayer;
  const rp = game.rightPlayer;
  if (lp != null) {
    assertLoaded(lp);
    if (lp.$jazz.id === ownerId) {
      return "left";
    }
  }
  if (rp != null) {
    assertLoaded(rp);
    if (rp.$jazz.id === ownerId) {
      return "right";
    }
  }
  return null;
}

function cellLabel(v: number): string {
  if (v === 0) {
    return "";
  }
  if (v === 1) {
    return "X";
  }
  if (v === 2) {
    return "O";
  }
  return "?";
}

export function GamePage({ runtime }: { runtime: AppRuntime }) {
  const account = useDeviceAccount();
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();

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

  const gameInList = useMemo(() => {
    if (!shared || !gameId) {
      return false;
    }
    const s = getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
    if (!s) {
      return false;
    }
    assertLoaded(s.games);
    return s.games.slice().some((g) => g.$jazz.id === gameId);
  }, [shared, gameId]);

  const loadedGame = useCoState(GameData, shared && gameId ? gameId : undefined, {
    resolve: {
      leftPlayer: true,
      rightPlayer: true,
    },
  });

  const guestClaimDone = useRef(false);
  useEffect(() => {
    guestClaimDone.current = false;
  }, [gameId]);

  useEffect(() => {
    if (!loadedGame.$isLoaded || !shared || gameInList || guestClaimDone.current) {
      return;
    }
    assertLoaded(loadedGame);
    const sharedLoaded = getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
    if (!sharedLoaded) {
      return;
    }
    assertLoaded(sharedLoaded);
    claimGuestSeatAndListIfNeeded(loadedGame, sharedLoaded);
    guestClaimDone.current = true;
  }, [loadedGame, shared, gameInList, gameId]);

  const mySide = useMemo(() => {
    if (!loadedGame.$isLoaded || !shared) {
      return null;
    }
    assertLoaded(loadedGame);
    const sharedLoaded = getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
    if (!sharedLoaded) {
      return null;
    }
    const og = sharedLoaded.$jazz.owner;
    if (!og) {
      return null;
    }
    return resolveMySide(og.$jazz.id, loadedGame);
  }, [loadedGame, shared]);

  const statusLine = useMemo(() => {
    if (!loadedGame.$isLoaded) {
      return "";
    }
    assertLoaded(loadedGame);
    const board = loadedGame.board as Board;
    if (loadedGame.gameState === "waiting") {
      return "Waiting for both players to join.";
    }
    if (loadedGame.gameState === "finished") {
      const out = evaluateLineOutcome(board);
      if (out.kind === "win") {
        return `Finished — ${out.side === "left" ? "Left" : "Right"} wins.`;
      }
      if (out.kind === "draw") {
        return "Finished — draw.";
      }
      return "Finished.";
    }
    if (mySide === null) {
      return "You are not a player in this game.";
    }
    if (loadedGame.currentPlayer === mySide) {
      return "Your turn.";
    }
    return "Opponent's turn.";
  }, [loadedGame, mySide]);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (!shared || !loadedGame.$isLoaded) {
        return;
      }
      assertLoaded(shared);
      assertLoaded(loadedGame);
      const og = shared.$jazz.owner;
      if (!og) {
        return;
      }
      const side = resolveMySide(og.$jazz.id, loadedGame);
      if (side === null) {
        return;
      }
      if (loadedGame.gameState !== "playing") {
        return;
      }
      if (loadedGame.currentPlayer !== side) {
        return;
      }
      const board = loadedGame.board as Board;
      if (board[row][col] !== 0) {
        return;
      }

      const mark = side === "left" ? CELL_LEFT : CELL_RIGHT;
      const newBoard = setBoardCell(board, row, col, mark);
      loadedGame.$jazz.set("board", newBoard);

      const outcome = evaluateLineOutcome(newBoard);
      if (outcome.kind === "win" || outcome.kind === "draw") {
        loadedGame.$jazz.set("gameState", "finished");
      } else {
        loadedGame.$jazz.set(
          "currentPlayer",
          loadedGame.currentPlayer === "left" ? "right" : "left",
        );
      }
    },
    [shared, loadedGame],
  );

  const handleDeleteGame = useCallback(async () => {
    if (!gameId || !shared || !account.$isLoaded) {
      return;
    }
    assertLoaded(account);
    assertLoaded(shared);
    assertLoaded(shared.games);
    const games = shared.games.slice();
    const index = games.findIndex((g) => g.$jazz.id === gameId);
    try {
      await deleteCoValues(GameData, gameId, {
        loadAs: account,
        resolve: {
          leftPlayer: true,
          rightPlayer: true,
        },
      });
    } catch (e) {
      console.error("Failed to delete game CoValue", e);
      return;
    }
    if (index !== -1) {
      shared.games.$jazz.splice(index, 1);
    }
    navigate("/");
  }, [account, shared, gameId, navigate]);

  const runtimeLabel = runtime === "desktop" ? "Desktop" : "Web";

  if (!account.$isLoaded) {
    return (
      <AppShell
        eyebrow="Game"
        title="Tic-tac-toe"
        subtitle="Loading account…"
      >
        <Card>
          <p className="text-[11px] text-slate-600">Bootstrapping your Jazz account…</p>
        </Card>
      </AppShell>
    );
  }

  if (!shared) {
    return (
      <AppShell
        eyebrow="Game"
        title="Tic-tac-toe"
        subtitle="No shared user data."
      >
        <div className="mb-3">
          <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
            ← Home
          </Link>
        </div>
        <Card>
          <p className="text-[11px] text-slate-600">
            Create or join shared user data from the home screen first.
          </p>
        </Card>
      </AppShell>
    );
  }

  if (!gameId) {
    return (
      <AppShell
        eyebrow="Game"
        title="Tic-tac-toe"
        subtitle="Missing game id."
      >
        <div className="mb-3">
          <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
            ← Home
          </Link>
        </div>
      </AppShell>
    );
  }

  if (gameId && shared && !loadedGame.$isLoaded) {
    const ls = loadedGame.$jazz.loadingState;
    if (ls === "unauthorized") {
      const sharedLoaded = getLoadedOrUndefined(shared as never) as LoadedShared | undefined;
      const ownerG = sharedLoaded?.$jazz.owner;
      const joinPayload =
        gameId && ownerG
          ? formatGameJoinPayload(gameId, ownerG.$jazz.id)
          : null;
      return (
        <AppShell
          eyebrow="Game"
          title="Tic-tac-toe"
          subtitle="No access to this game."
        >
          <div className="mb-3">
            <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
              ← Home
            </Link>
          </div>
          <Card>
            <p className="text-[11px] text-slate-600">
              Ask the host to add your shared user group as a writer on this game. Send them the join payload below
              (or only your user group id). The host pastes it under &quot;Accept join&quot; for this game.
            </p>
            {joinPayload ? (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Join payload</p>
                <p className="break-all rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-[10px] text-slate-800">
                  {joinPayload}
                </p>
                <Button
                  type="button"
                  className="text-[10px]"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(joinPayload);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  Copy join payload
                </Button>
              </div>
            ) : null}
            <Button type="button" className="mt-3" onClick={() => navigate("/")}>
              Back to home
            </Button>
          </Card>
        </AppShell>
      );
    }
    if (ls === "unavailable") {
      return (
        <AppShell
          eyebrow="Game"
          title="Tic-tac-toe"
          subtitle="Game unavailable."
        >
          <div className="mb-3">
            <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
              ← Home
            </Link>
          </div>
          <Card>
            <p className="text-[11px] text-slate-600">This game could not be found on the network.</p>
            <Button type="button" className="mt-3" onClick={() => navigate("/")}>
              Back to home
            </Button>
          </Card>
        </AppShell>
      );
    }
    return (
      <AppShell
        eyebrow="Game"
        title="Tic-tac-toe"
        subtitle="Loading game…"
      >
        <div className="mb-3">
          <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
            ← Home
          </Link>
        </div>
        <Card>
          <p className="text-[11px] text-slate-600">Syncing game state from Jazz…</p>
        </Card>
      </AppShell>
    );
  }

  assertLoaded(loadedGame);
  const board = loadedGame.board as Board;
  const leftSeat = loadedGame.leftPlayer != null;
  const rightSeat = loadedGame.rightPlayer != null;

  return (
    <AppShell
      eyebrow="Game"
      title="Tic-tac-toe"
      subtitle="Left plays X, right plays O. State syncs across devices."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link to="/" className="text-[11px] font-medium text-sky-700 hover:underline">
          ← Home
        </Link>
        <Button
          type="button"
          className="border border-red-200 bg-red-50 text-[10px] text-red-800 hover:bg-red-100"
          onClick={handleDeleteGame}
        >
          Delete game
        </Button>
        <Badge>{runtimeLabel}</Badge>
        <Badge tone={loadedGame.gameState === "playing" ? "success" : "default"}>
          {loadedGame.gameState}
        </Badge>
      </div>

      <Card>
        <div className="space-y-3 text-[11px] text-slate-700">
          <p className="break-all font-mono text-[10px] text-slate-500">
            <span className="font-medium text-slate-600">Game id:</span> {loadedGame.$jazz.id}
          </p>
          <div className="flex flex-wrap gap-2">
            <span>
              <span className="text-slate-500">Current player:</span>{" "}
              <span className="font-medium">{loadedGame.currentPlayer}</span>
            </span>
            <span className="text-slate-400">·</span>
            <span>
              <span className="text-slate-500">Left seat:</span> {leftSeat ? "filled" : "open"}
            </span>
            <span className="text-slate-400">·</span>
            <span>
              <span className="text-slate-500">Right seat:</span> {rightSeat ? "filled" : "open"}
            </span>
          </div>
          <p className="text-slate-800">{statusLine}</p>

          <div className="inline-grid grid-cols-3 gap-1.5 rounded border border-slate-200 bg-slate-50 p-2">
            {board.map((row, ri) =>
              row.map((cell, ci) => {
                const canPlay =
                  loadedGame.gameState === "playing" &&
                  mySide !== null &&
                  loadedGame.currentPlayer === mySide &&
                  cell === 0;
                return (
                  <button
                    key={`${ri}-${ci}`}
                    type="button"
                    disabled={!canPlay}
                    onClick={() => handleCellClick(ri, ci)}
                    className={`flex h-14 w-14 items-center justify-center rounded border text-lg font-semibold transition ${
                      canPlay
                        ? "border-sky-400 bg-white text-slate-900 hover:bg-sky-50"
                        : "cursor-default border-slate-200 bg-white text-slate-700"
                    } disabled:cursor-not-allowed disabled:opacity-70`}
                  >
                    {cellLabel(cell)}
                  </button>
                );
              }),
            )}
          </div>
          <p className="text-[10px] text-slate-500">
            You play as {mySide === "left" ? "Left (X)" : mySide === "right" ? "Right (O)" : "— (not seated)"}.
          </p>
        </div>
      </Card>
    </AppShell>
  );
}
