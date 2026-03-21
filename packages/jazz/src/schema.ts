import { co, z } from "jazz-tools";

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

export const UserData = co.map({
  userData: co
    .map({
      // Name of the user that represents the group of devices
      name: z.string(),
      devices: co.list(co.account()),
      games: co.list(GameData),
    })
    .optional(),
});

export const DeviceAccount = co.account({
  root: UserData,
  profile: co.profile(),
});
