import type { DesktopSyncStatus } from "./runtime";

export {};

declare global {
  interface Window {
    desktopShell?: {
      platform: string;
      hostname: string;
      sync: {
        getStatus(): Promise<DesktopSyncStatus>;
        startLocalServer(): Promise<DesktopSyncStatus>;
        stopLocalServer(): Promise<DesktopSyncStatus>;
        setAdvertisedHostnames(hostnames: string[]): Promise<DesktopSyncStatus>;
        onStatusChange(listener: (status: DesktopSyncStatus) => void): () => void;
      };
    };
  }
}
