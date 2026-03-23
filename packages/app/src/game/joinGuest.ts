import { assertLoaded, GameData, type SharedUserData } from "@repo/jazz";
import type { Loaded } from "@repo/jazz";

type LoadedShared = Loaded<typeof SharedUserData>;

/**
 * Guest has writer on the game but may not have listed it yet; claim the open seat
 * and add the game to this shared user's list (same as legacy invite accept flow).
 */
export function claimGuestSeatAndListIfNeeded(
  loadedGame: Loaded<typeof GameData>,
  sharedUser: LoadedShared,
): void {
  assertLoaded(sharedUser);
  const ownerGroup = sharedUser.$jazz.owner;
  if (!ownerGroup) {
    return;
  }

  const hasLeft = loadedGame.leftPlayer !== undefined && loadedGame.leftPlayer !== null;
  const hasRight = loadedGame.rightPlayer !== undefined && loadedGame.rightPlayer !== null;
  if (hasLeft && hasRight) {
    assertLoaded(sharedUser.games);
    const alreadyListed = sharedUser.games
      .slice()
      .some((g) => g.$jazz.id === loadedGame.$jazz.id);
    if (!alreadyListed) {
      sharedUser.games.$jazz.push(loadedGame);
    }
    return;
  }

  if (!hasLeft) {
    loadedGame.$jazz.set("leftPlayer", ownerGroup);
  } else {
    loadedGame.$jazz.set("rightPlayer", ownerGroup);
  }

  assertLoaded(sharedUser.games);
  const alreadyListed = sharedUser.games.slice().some((g) => g.$jazz.id === loadedGame.$jazz.id);
  if (!alreadyListed) {
    sharedUser.games.$jazz.push(loadedGame);
  }

  const leftAfter = loadedGame.leftPlayer !== undefined && loadedGame.leftPlayer !== null;
  const rightAfter = loadedGame.rightPlayer !== undefined && loadedGame.rightPlayer !== null;
  if (leftAfter && rightAfter) {
    loadedGame.$jazz.set("gameState", "playing");
  }
}

export function formatGameJoinPayload(gameId: string, guestUserGroupId: string): string {
  return `${gameId}|${guestUserGroupId}`;
}

/** Parses `gameId|guestUserGroupId` from the host paste field. */
export function parseGuestGroupIdFromPayload(payload: string): string | undefined {
  const trimmed = payload.trim();
  const pipe = trimmed.indexOf("|");
  if (pipe === -1) {
    return trimmed.length > 0 ? trimmed : undefined;
  }
  const rest = trimmed.slice(pipe + 1).trim();
  return rest.length > 0 ? rest : undefined;
}
