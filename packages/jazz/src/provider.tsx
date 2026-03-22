import type { PropsWithChildren } from "react";
import { JazzReactProvider } from "jazz-tools/react";
import { DeviceAccount } from "./schema";

const FALLBACK_JAZZ_API_KEY = "demo@example.com";

export function resolveJazzApiKey(apiKey?: string) {
  const trimmed = apiKey?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : FALLBACK_JAZZ_API_KEY;
}

export function JazzAppProvider({
  apiKey,
  children,
}: PropsWithChildren<{ apiKey?: string }>) {
  return (
    <JazzReactProvider
      sync={{
        peer: `wss://cloud.jazz.tools/?key=${resolveJazzApiKey(apiKey)}`,
        when: "always",
      }}
      AccountSchema={DeviceAccount}
    >
      {children}
    </JazzReactProvider>
  );
}
