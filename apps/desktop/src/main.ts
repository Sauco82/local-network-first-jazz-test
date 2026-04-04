import { app, BrowserWindow, ipcMain } from "electron";
import os from "node:os";
import path from "node:path";
import { DesktopSyncService } from "./localSyncServer";

const DESKTOP_SHELL_HOSTNAME_CHANNEL = "desktop-shell:get-hostname";
const DESKTOP_SYNC_STATUS_CHANNEL = "desktop-sync:status-changed";
const DESKTOP_SYNC_GET_STATUS_CHANNEL = "desktop-sync:get-status";
const DESKTOP_SYNC_START_CHANNEL = "desktop-sync:start";
const DESKTOP_SYNC_STOP_CHANNEL = "desktop-sync:stop";
const DESKTOP_SYNC_SET_HOSTNAMES_CHANNEL = "desktop-sync:set-advertised-hostnames";

const desktopSync = new DesktopSyncService();

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#020617",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    void window.loadURL(devServerUrl);
    window.webContents.openDevTools({ mode: "detach" });
    return;
  }

  void window.loadFile(path.resolve(__dirname, "../../web/dist/index.html"));
}

function broadcastDesktopSyncStatus() {
  const status = desktopSync.getStatus();
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(DESKTOP_SYNC_STATUS_CHANNEL, status);
    }
  }
}

function registerDesktopSyncIpc() {
  ipcMain.on(DESKTOP_SHELL_HOSTNAME_CHANNEL, (event) => {
    event.returnValue = os.hostname();
  });
  ipcMain.handle(DESKTOP_SYNC_GET_STATUS_CHANNEL, () => desktopSync.getStatus());
  ipcMain.handle(DESKTOP_SYNC_START_CHANNEL, async () => {
    const status = await desktopSync.start();
    broadcastDesktopSyncStatus();
    return status;
  });
  ipcMain.handle(DESKTOP_SYNC_STOP_CHANNEL, async () => {
    const status = await desktopSync.stop();
    broadcastDesktopSyncStatus();
    return status;
  });
  ipcMain.handle(DESKTOP_SYNC_SET_HOSTNAMES_CHANNEL, (_event, hostnames: string[]) => {
    const status = desktopSync.updateAdvertisedHostnames(hostnames);
    broadcastDesktopSyncStatus();
    return status;
  });
}

app.whenReady().then(() => {
  registerDesktopSyncIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void desktopSync.stop();
  desktopSync.destroy();
});
