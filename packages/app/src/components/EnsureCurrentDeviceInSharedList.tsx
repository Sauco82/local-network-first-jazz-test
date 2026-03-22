import { useEffect } from "react";
import { Account, assertLoaded } from "@repo/jazz";
import type { SharedUserData } from "@repo/jazz";
import type { Loaded } from "@repo/jazz";

type LoadedShared = Loaded<typeof SharedUserData>;

/**
 * Keeps the current device account in `shared.devices`. This is imperative
 * collaborative state; a single effect is the appropriate tool.
 */
export function EnsureCurrentDeviceInSharedList({
  shared,
}: {
  shared: LoadedShared;
}) {
  useEffect(() => {
    assertLoaded(shared);
    assertLoaded(shared.devices);
    const me = Account.getMe();
    const already = shared.devices.slice().some((device) => device.$jazz.id === me.$jazz.id);
    if (!already) {
      shared.devices.$jazz.push(me as (typeof shared.devices)[number]);
    }
  }, [shared, shared.$jazz.id]);

  return null;
}
