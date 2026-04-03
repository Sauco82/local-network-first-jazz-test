import { once } from "node:events";
import path from "node:path";
import { app } from "electron";
import { startSyncServer } from "jazz-run/startSyncServer";

const DEFAULT_LOCAL_SYNC_HOST = "127.0.0.1";
const DEFAULT_LOCAL_SYNC_PORT = 4200;

export type DesktopSyncStatus = {
  running: boolean;
  host: string;
  port: number;
  peer: string;
  dbPath: string | null;
  error: string | null;
};

type SyncServerInstance = Awaited<ReturnType<typeof startSyncServer>>;

function resolveLocalSyncPort(): number {
  const raw = process.env.JAZZ_LOCAL_SYNC_PORT?.trim();
  if (!raw) {
    return DEFAULT_LOCAL_SYNC_PORT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_LOCAL_SYNC_PORT;
}

function buildLocalSyncPeer(port: number): string {
  return `ws://${DEFAULT_LOCAL_SYNC_HOST}:${port}`;
}

export class DesktopSyncService {
  private server: SyncServerInstance | null = null;
  private startPromise: Promise<DesktopSyncStatus> | null = null;
  private error: string | null = null;

  getStatus(): DesktopSyncStatus {
    const port = resolveLocalSyncPort();
    const dbPath = path.join(app.getPath("userData"), "jazz-sync", "storage.db");

    return {
      running: this.server !== null,
      host: DEFAULT_LOCAL_SYNC_HOST,
      port,
      peer: buildLocalSyncPeer(port),
      dbPath,
      error: this.error,
    };
  }

  async start(): Promise<DesktopSyncStatus> {
    if (this.server) {
      return this.getStatus();
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    const port = resolveLocalSyncPort();
    const dbPath = path.join(app.getPath("userData"), "jazz-sync", "storage.db");

    this.error = null;
    this.startPromise = startSyncServer({
      host: DEFAULT_LOCAL_SYNC_HOST,
      port: String(port),
      inMemory: false,
      db: dbPath,
    })
      .then((server) => {
        this.server = server;
        this.error = null;
        return this.getStatus();
      })
      .catch((error: unknown) => {
        this.server = null;
        this.error = error instanceof Error ? error.message : "Could not start local sync server.";
        return this.getStatus();
      })
      .finally(() => {
        this.startPromise = null;
      });

    return this.startPromise;
  }

  async stop(): Promise<DesktopSyncStatus> {
    if (this.startPromise) {
      await this.startPromise;
    }
    if (!this.server) {
      this.error = null;
      return this.getStatus();
    }

    const currentServer = this.server;
    this.server = null;
    this.error = null;

    try {
      currentServer.close();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not stop local sync server.";
      return this.getStatus();
    }

    await Promise.race([
      once(currentServer, "close").then(() => undefined),
      new Promise<void>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Timed out while stopping local sync server."));
        }, 3000);
      }),
    ]).catch((error: unknown) => {
      this.error = error instanceof Error ? error.message : "Could not stop local sync server.";
    });

    return this.getStatus();
  }
}
