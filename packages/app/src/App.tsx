import { JazzAppProvider } from "@repo/jazz";
import type { AppRuntime } from "./runtime";
import { UserDevicesWorkspace } from "./UserDevicesWorkspace";

export function App({ apiKey, runtime }: { apiKey?: string; runtime: AppRuntime }) {
  return (
    <JazzAppProvider apiKey={apiKey}>
      <UserDevicesWorkspace apiKey={apiKey} runtime={runtime} />
    </JazzAppProvider>
  );
}

export type { AppRuntime } from "./runtime";
