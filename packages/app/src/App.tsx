import { JazzAppProvider } from "@repo/jazz";
import { HashRouter, Route, Routes } from "react-router-dom";
import { GamePage } from "./components/GamePage";
import type { AppRuntime } from "./runtime";
import { UserDevicesWorkspace } from "./UserDevicesWorkspace";

export function App({ apiKey, runtime }: { apiKey?: string; runtime: AppRuntime }) {
  return (
    <JazzAppProvider apiKey={apiKey}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<UserDevicesWorkspace apiKey={apiKey} runtime={runtime} />} />
          <Route path="/game/:gameId" element={<GamePage runtime={runtime} />} />
        </Routes>
      </HashRouter>
    </JazzAppProvider>
  );
}

export type { AppRuntime } from "./runtime";
