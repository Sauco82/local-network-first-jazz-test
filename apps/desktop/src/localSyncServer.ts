import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { Bonjour, type Service } from "bonjour-service";
import { startSyncServer } from "jazz-run/startSyncServer";

const DEFAULT_LOCAL_SYNC_BIND_HOST = "0.0.0.0";
const DEFAULT_LOCAL_SYNC_LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_LOCAL_SYNC_PORT = 4200;
const DESKTOP_SYNC_CONFIG_FILE = "sync-hostnames.json";
const MDNS_SERVICE_TYPE = "jazzsync";

export type DesktopAdvertisedPeer = {
  id: string;
  label: string;
  hostname: string;
  peer: `ws://${string}` | `wss://${string}`;
  note: string | null;
};

export type DesktopSyncStatus = {
  running: boolean;
  host: string;
  port: number;
  peer: `ws://${string}` | `wss://${string}`;
  loopbackPeer: `ws://${string}` | `wss://${string}`;
  advertisedHostnames: string[];
  advertisedPeers: DesktopAdvertisedPeer[];
  dbPath: string | null;
  error: string | null;
};

type SyncServerInstance = Awaited<ReturnType<typeof startSyncServer>>;
type DesktopSyncConfig = {
  advertisedHostnames: string[];
};

function resolveLocalSyncPort(): number {
  const raw = process.env.JAZZ_LOCAL_SYNC_PORT?.trim();
  if (!raw) {
    return DEFAULT_LOCAL_SYNC_PORT;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_LOCAL_SYNC_PORT;
}

function buildLoopbackSyncPeer(port: number): `ws://${string}` {
  return `ws://${DEFAULT_LOCAL_SYNC_LOOPBACK_HOST}:${port}`;
}

function buildAdvertisedSyncPeer(hostname: string, port: number): `ws://${string}` {
  return `ws://${hostname}.local:${port}`;
}

function buildConfigPath() {
  return path.join(app.getPath("userData"), "jazz-sync", DESKTOP_SYNC_CONFIG_FILE);
}

function buildDbPath() {
  return path.join(app.getPath("userData"), "jazz-sync", "storage.db");
}

function normalizeAdvertisedHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  let candidate = trimmed;

  if (candidate.includes("://")) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  }

  candidate = candidate.replace(/\.local$/u, "");
  candidate = candidate.replace(/[^a-z0-9-]/gu, "-");
  candidate = candidate.replace(/-+/gu, "-");
  candidate = candidate.replace(/^-|-$/gu, "");

  if (!candidate) {
    return null;
  }

  return candidate;
}

function resolveDefaultAdvertisedHostnames(): string[] {
  const fallback = normalizeAdvertisedHostname(os.hostname()) ?? "jazz-sync";
  return [fallback];
}

function readDesktopSyncConfig(): DesktopSyncConfig {
  const configPath = buildConfigPath();

  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Partial<DesktopSyncConfig>;
    const advertisedHostnames = Array.isArray(parsed.advertisedHostnames)
      ? parsed.advertisedHostnames
          .map((value) => normalizeAdvertisedHostname(String(value)))
          .filter((value): value is string => value !== null)
      : [];

    return {
      advertisedHostnames:
        advertisedHostnames.length > 0 ? Array.from(new Set(advertisedHostnames)) : resolveDefaultAdvertisedHostnames(),
    };
  } catch {
    return {
      advertisedHostnames: resolveDefaultAdvertisedHostnames(),
    };
  }
}

function writeDesktopSyncConfig(config: DesktopSyncConfig) {
  const configPath = buildConfigPath();
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function buildAdvertisedPeers(hostnames: string[], port: number): DesktopAdvertisedPeer[] {
  return hostnames.map((hostname, index) => ({
    id: `desktop-advertised:${hostname}:${index}`,
    label: `${hostname}.local`,
    hostname,
    peer: buildAdvertisedSyncPeer(hostname, port),
    note: "Share this URL with other clients on the local network.",
  }));
}

export class DesktopSyncService {
  private server: SyncServerInstance | null = null;
  private startPromise: Promise<DesktopSyncStatus> | null = null;
  private error: string | null = null;
  private readonly bonjour = new Bonjour(undefined, (error: unknown) => {
    this.error = error instanceof Error ? error.message : "mDNS registration failed.";
  });
  private publishedServices: Service[] = [];
  private advertisedHostnames = readDesktopSyncConfig().advertisedHostnames;

  getStatus(): DesktopSyncStatus {
    const port = resolveLocalSyncPort();
    const loopbackPeer = buildLoopbackSyncPeer(port);

    return {
      running: this.server !== null,
      host: DEFAULT_LOCAL_SYNC_BIND_HOST,
      port,
      peer: loopbackPeer,
      loopbackPeer,
      advertisedHostnames: [...this.advertisedHostnames],
      advertisedPeers: buildAdvertisedPeers(this.advertisedHostnames, port),
      dbPath: buildDbPath(),
      error: this.error,
    };
  }

  updateAdvertisedHostnames(hostnames: string[]): DesktopSyncStatus {
    const nextHostnames = Array.from(
      new Set(
        hostnames
          .map((value) => normalizeAdvertisedHostname(value))
          .filter((value): value is string => value !== null),
      ),
    );

    this.advertisedHostnames =
      nextHostnames.length > 0 ? nextHostnames : resolveDefaultAdvertisedHostnames();
    writeDesktopSyncConfig({ advertisedHostnames: this.advertisedHostnames });
    this.refreshMdnsAdvertisements();
    return this.getStatus();
  }

  private unpublishMdnsAdvertisements() {
    for (const service of this.publishedServices) {
      try {
        service.stop?.();
      } catch {
        // ignore teardown failures
      }
    }
    this.publishedServices = [];
  }

  private refreshMdnsAdvertisements() {
    this.unpublishMdnsAdvertisements();

    if (!this.server) {
      return;
    }

    const port = resolveLocalSyncPort();
    this.publishedServices = buildAdvertisedPeers(this.advertisedHostnames, port).map((peer) => {
      const service = this.bonjour.publish({
        name: `Jazz Sync ${peer.hostname}`,
        type: MDNS_SERVICE_TYPE,
        protocol: "tcp",
        host: `${peer.hostname}.local`,
        port,
        txt: {
          peer: peer.peer,
          label: peer.label,
        },
      });

      service.on("error", (error: unknown) => {
        this.error = error instanceof Error ? error.message : "mDNS registration failed.";
      });

      return service;
    });
  }

  async start(): Promise<DesktopSyncStatus> {
    if (this.server) {
      return this.getStatus();
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    const port = resolveLocalSyncPort();
    const dbPath = buildDbPath();

    this.error = null;
    this.startPromise = startSyncServer({
      host: DEFAULT_LOCAL_SYNC_BIND_HOST,
      port: String(port),
      inMemory: false,
      db: dbPath,
    })
      .then((server) => {
        this.server = server;
        this.error = null;
        this.refreshMdnsAdvertisements();
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
    this.unpublishMdnsAdvertisements();

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

  destroy() {
    this.unpublishMdnsAdvertisements();
    this.bonjour.destroy();
  }
}
