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
          games: { $each: true },
        },
      },
    },
  });
}

export type DeviceAccountFromHook = ReturnType<typeof useDeviceAccount>;
