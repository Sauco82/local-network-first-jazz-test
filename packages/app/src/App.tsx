import { JazzAppProvider } from "@repo/jazz";
import { HashRouter, Route, Routes } from "react-router-dom";
import { GamePage } from "./components/GamePage";
import type { AppRuntime } from "./runtime";
import { UserDevicesWorkspace, UserDevicesWorkspaceLoading } from "./UserDevicesWorkspace";
import { useSyncSettings } from "./useSyncSettings";

export function App({
  apiKey,
  runtime,
}: {
  apiKey?: string;
  runtime: AppRuntime;
}) {
  const syncState = useSyncSettings({ apiKey });
  const providerKey = syncState.resolvedPeer.peer ?? "none";
  const isJazzReady =
    syncState.syncWhen === "always" &&
    !syncState.isResolvingPeer &&
    Boolean(syncState.resolvedPeer.peer);

  if (!isJazzReady) {
    return (
      <UserDevicesWorkspaceLoading
        apiKey={apiKey}
        runtime={runtime}
        syncState={syncState}
      />
    );
  }

  return (
    <JazzAppProvider
      key={providerKey}
      apiKey={apiKey}
      peer={syncState.resolvedPeer.peer ?? undefined}
      syncWhen={syncState.syncWhen}
    >
      <HashRouter>
        <Routes>
          <Route
            path="/"
            element={
              <UserDevicesWorkspace
                apiKey={apiKey}
                runtime={runtime}
                syncState={syncState}
              />
            }
          />
          <Route path="/game/:gameId" element={<GamePage runtime={runtime} />} />
        </Routes>
      </HashRouter>
    </JazzAppProvider>
  );
}

export type { AppRuntime } from "./runtime";
