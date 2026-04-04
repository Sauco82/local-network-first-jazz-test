import { contextBridge, ipcRenderer } from "electron";

const DESKTOP_SHELL_HOSTNAME_CHANNEL = "desktop-shell:get-hostname";
const DESKTOP_SYNC_STATUS_CHANNEL = "desktop-sync:status-changed";
const DESKTOP_SYNC_GET_STATUS_CHANNEL = "desktop-sync:get-status";
const DESKTOP_SYNC_START_CHANNEL = "desktop-sync:start";
const DESKTOP_SYNC_STOP_CHANNEL = "desktop-sync:stop";
const DESKTOP_SYNC_SET_HOSTNAMES_CHANNEL = "desktop-sync:set-advertised-hostnames";

contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform,
  hostname: ipcRenderer.sendSync(DESKTOP_SHELL_HOSTNAME_CHANNEL),
  sync: {
    getStatus: () => ipcRenderer.invoke(DESKTOP_SYNC_GET_STATUS_CHANNEL),
    startLocalServer: () => ipcRenderer.invoke(DESKTOP_SYNC_START_CHANNEL),
    stopLocalServer: () => ipcRenderer.invoke(DESKTOP_SYNC_STOP_CHANNEL),
    setAdvertisedHostnames: (hostnames: string[]) =>
      ipcRenderer.invoke(DESKTOP_SYNC_SET_HOSTNAMES_CHANNEL, hostnames),
    onStatusChange: (listener: (status: unknown) => void) => {
      const wrappedListener = (_event: unknown, status: unknown) => listener(status);
      ipcRenderer.on(DESKTOP_SYNC_STATUS_CHANNEL, wrappedListener);
      return () => {
        ipcRenderer.removeListener(DESKTOP_SYNC_STATUS_CHANNEL, wrappedListener);
      };
    },
  },
});
