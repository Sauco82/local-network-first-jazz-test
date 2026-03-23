import { useAccount } from "jazz-tools/react";
import { DeviceAccount } from "./schema";

/**
 * `useAccount` passes `resolve` through as-is (it does not merge with the schema default).
 * Account subscriptions must include **`profile` and `root`**; omitting `profile` caused
 * Jazz validation: "The ref root is required but missing" when only `root` was specified.
 */
export function useDeviceAccount() {
  return useAccount(DeviceAccount, {
    resolve: {
      profile: true,
      root: {
        userData: {
          devices: { $each: { profile: true } },
          // Shallow list only: deep `$each` forces resolving every GameData (and nested Group
          // refs for left/right players) at account scope. A joiner can hold a game ref in
          // `games` before they have read access to the full CoValue tree; shallow refs avoid
          // authorization errors on the account subscription. Components load each game as needed.
          games: true,
        },
      },
    },
  });
}

export type DeviceAccountFromHook = ReturnType<typeof useDeviceAccount>;
