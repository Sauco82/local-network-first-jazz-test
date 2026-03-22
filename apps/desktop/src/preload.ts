import { contextBridge } from "electron";
import os from "node:os";

contextBridge.exposeInMainWorld("desktopShell", {
  platform: process.platform,
  hostname: os.hostname(),
});
