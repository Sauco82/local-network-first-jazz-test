import { co, Group, z } from "jazz-tools";

function defaultDeviceProfileName(): string {
  if (typeof window === "undefined") {
    return "Device";
  }
  const host = (window as { desktopShell?: { hostname?: string } }).desktopShell?.hostname;
  if (host) {
    return host;
  }
  if (window.location?.hostname) {
    return `${window.location.hostname} (browser)`;
  }
  return "Device";
}

export const GameData = co.map({
  leftPlayer: co.account().optional(),
  rightPlayer: co.account().optional(),
  board: z.tuple([
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
    z.tuple([z.number(), z.number(), z.number()]),
  ]),
  currentPlayer: z.enum(["left", "right"]),
  gameState: z.enum(["waiting", "playing", "finished"]),
});

/** Collaborative user payload (group-owned for invites). */
export const SharedUserData = co.map({
  // Name of the user that represents the group of devices
  name: z.string(),
  devices: co.list(co.account()),
  games: co.list(GameData),
});

export const UserData = co.map({
  userData: SharedUserData.optional(),
});

/**
 * Ensures `root` exists on persisted accounts. Without it, subscriptions fail with
 * "The ref root is required but missing" because the account map has no root CoValue id yet
 * (e.g. sessions created before this schema or incomplete account state).
 */
export const DeviceAccount = co
  .account({
    root: UserData,
    profile: co.profile(),
  })
  .withMigration(async (account) => {
    if (!account.$jazz.has("root")) {
      const userDataRoot = UserData.create({}, { owner: account });
      account.$jazz.set("root", userDataRoot);
    }
    if (!account.$jazz.has("profile")) {
      const profileGroup = Group.create();
      account.$jazz.set(
        "profile",
        co.profile().create({ name: defaultDeviceProfileName() }, profileGroup),
      );
      profileGroup.addMember("everyone", "reader");
    }
  });
