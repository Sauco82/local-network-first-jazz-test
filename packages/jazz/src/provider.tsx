import type { PropsWithChildren } from "react";
import { JazzReactProvider } from "jazz-tools/react";
import { DeviceAccount } from "./schema";

const FALLBACK_JAZZ_API_KEY = "demo@example.com";

export function resolveJazzApiKey(apiKey?: string) {
  const trimmed = apiKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : FALLBACK_JAZZ_API_KEY;
}

export function resolveJazzPeer({
  apiKey,
  peer,
}: {
  apiKey?: string;
  peer?: string;
}): `ws://${string}` | `wss://${string}` {
  const trimmedPeer = peer?.trim();
  if (trimmedPeer) {
    return trimmedPeer as `ws://${string}` | `wss://${string}`;
  }
  return `wss://cloud.jazz.tools/?key=${resolveJazzApiKey(apiKey)}`;
}

export function JazzAppProvider({
  apiKey,
  peer,
  syncWhen = "always",
  children,
}: PropsWithChildren<{ apiKey?: string; peer?: string; syncWhen?: "always" | "never" }>) {
  return (
    <JazzReactProvider
      sync={{
        peer: resolveJazzPeer({ apiKey, peer }),
        when: syncWhen,
      }}
      AccountSchema={DeviceAccount}
    >
      {children}
    </JazzReactProvider>
  );
}
