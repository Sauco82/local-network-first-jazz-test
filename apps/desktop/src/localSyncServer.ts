import { createServer, type IncomingMessage, type Server } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import os from "node:os";
import path from "node:path";
import { LocalNode } from "cojson";
import { getBetterSqliteStorage } from "cojson-storage-sqlite";
import {
  type AnyWebSocketConstructor,
  WebSocketPeerWithReconnection,
  createWebSocketPeer,
} from "cojson-transport-ws";
import { WasmCrypto } from "cojson/crypto/WasmCrypto";
import { app } from "electron";
import { Bonjour, type Service } from "bonjour-service";
import NodeWebSocket, { WebSocketServer, type WebSocket } from "ws";

const DEFAULT_LOCAL_SYNC_BIND_HOST = "0.0.0.0";
const DEFAULT_LOCAL_SYNC_LOOPBACK_HOST = "127.0.0.1";
const DEFAULT_LOCAL_SYNC_PORT = 4200;
const DESKTOP_SYNC_CONFIG_FILE = "sync-hostnames.json";
const MDNS_SERVICE_TYPE = "jazzsync";
const FALLBACK_JAZZ_API_KEY = "demo@example.com";

export type SyncPeer = `ws://${string}` | `wss://${string}`;
export type ParentSyncStatus = "stopped" | "connecting" | "connected" | "reconnecting" | "error";

export type DesktopAdvertisedPeer = {
  id: string;
  label: string;
  hostname: string;
  peer: SyncPeer;
  note: string | null;
};

export type DesktopSyncStatus = {
  running: boolean;
  host: string;
  port: number;
  peer: SyncPeer;
  loopbackPeer: SyncPeer;
  advertisedHostnames: string[];
  advertisedPeers: DesktopAdvertisedPeer[];
  dbPath: string | null;
  error: string | null;
  parentPeer: SyncPeer | null;
  parentStatus: ParentSyncStatus;
  parentConnected: boolean;
  parentError: string | null;
};
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

function buildLoopbackSyncPeer(port: number): SyncPeer {
  return `ws://${DEFAULT_LOCAL_SYNC_LOOPBACK_HOST}:${port}` as SyncPeer;
}

function buildAdvertisedSyncPeer(hostname: string, port: number): SyncPeer {
  return `ws://${hostname}.local:${port}` as SyncPeer;
}

function normalizeSyncPeer(value: string): SyncPeer | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
      return null;
    }
    return parsed.toString().replace(/\/$/u, "") as SyncPeer;
  } catch {
    return null;
  }
}

function resolveJazzApiKey() {
  const candidates = [
    process.env.JAZZ_API_KEY,
    process.env.VITE_JAZZ_API_KEY,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return FALLBACK_JAZZ_API_KEY;
}

function buildDefaultParentSyncPeer(): SyncPeer {
  return `wss://cloud.jazz.tools/?key=${resolveJazzApiKey()}` as SyncPeer;
}

function resolveParentSyncPeerConfig(): {
  peer: SyncPeer | null;
  error: string | null;
} {
  const override = process.env.JAZZ_PARENT_SYNC_PEER?.trim();
  if (!override) {
    return {
      peer: buildDefaultParentSyncPeer(),
      error: null,
    };
  }

  const normalizedPeer = normalizeSyncPeer(override);
  if (!normalizedPeer) {
    return {
      peer: null,
      error: "Invalid JAZZ_PARENT_SYNC_PEER. Expected a ws:// or wss:// URL.",
    };
  }

  return {
    peer: normalizedPeer,
    error: null,
  };
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
  private server: Server | null = null;
  private websocketServer: WebSocketServer | null = null;
  private localNode: LocalNode | null = null;
  private connections = new Set<WebSocket>();
  private startPromise: Promise<DesktopSyncStatus> | null = null;
  private error: string | null = null;
  private parentPeer: SyncPeer | null = null;
  private parentStatus: ParentSyncStatus = "stopped";
  private parentConnected = false;
  private parentError: string | null = null;
  private parentConnector: WebSocketPeerWithReconnection | null = null;
  private parentConnectionListener: ((connected: boolean) => void) | null = null;
  private hasConnectedToParent = false;
  private readonly statusListeners = new Set<(status: DesktopSyncStatus) => void>();
  private readonly bonjour = new Bonjour(undefined, (error: unknown) => {
    this.error = error instanceof Error ? error.message : "mDNS registration failed.";
    this.emitStatusChange();
  });
  private publishedServices: Service[] = [];
  private advertisedHostnames = readDesktopSyncConfig().advertisedHostnames;

  onStatusChange(listener: (status: DesktopSyncStatus) => void) {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  private emitStatusChange() {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

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
      parentPeer: this.parentPeer,
      parentStatus: this.parentStatus,
      parentConnected: this.parentConnected,
      parentError: this.parentError,
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
    const status = this.getStatus();
    this.emitStatusChange();
    return status;
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
        this.emitStatusChange();
      });

      return service;
    });
  }

  private attachParentPeer(localNode: LocalNode, peer: SyncPeer) {
    this.stopParentPeer(false);

    this.parentPeer = peer;
    this.parentStatus = "connecting";
    this.parentConnected = false;
    this.parentError = null;
    this.hasConnectedToParent = false;

    const listener = (connected: boolean) => {
      this.parentConnected = connected;
      if (connected) {
        this.parentStatus = "connected";
        this.parentError = null;
        this.hasConnectedToParent = true;
      } else if (this.parentPeer) {
        this.parentStatus = this.hasConnectedToParent ? "reconnecting" : "connecting";
        this.parentError = `Parent sync peer ${this.parentPeer} is unavailable. Retrying.`;
      } else {
        this.parentStatus = "stopped";
        this.parentError = null;
      }
      this.emitStatusChange();
    };

    const parentConnector = new WebSocketPeerWithReconnection({
      peer,
      reconnectionTimeout: 500,
      addPeer: (nextPeer) => {
        localNode.syncManager.addPeer(nextPeer);
      },
      removePeer: () => {},
      WebSocketConstructor: NodeWebSocket as unknown as AnyWebSocketConstructor,
    });
    parentConnector.subscribe(listener);
    parentConnector.enable();

    this.parentConnectionListener = listener;
    this.parentConnector = parentConnector;
  }

  private stopParentPeer(emitStatusChange = true) {
    if (this.parentConnector && this.parentConnectionListener) {
      this.parentConnector.unsubscribe(this.parentConnectionListener);
    }
    this.parentConnector?.disable();
    this.parentConnector = null;
    this.parentConnectionListener = null;
    this.hasConnectedToParent = false;
    this.parentConnected = false;
    this.parentStatus = "stopped";
    this.parentError = null;
    this.parentPeer = null;

    if (emitStatusChange) {
      this.emitStatusChange();
    }
  }

  private async createRelayServer({
    port,
    dbPath,
  }: {
    port: number;
    dbPath: string;
  }) {
    const crypto = await WasmCrypto.create();
    const agentSecret = crypto.newRandomAgentSecret();
    const agentID = crypto.getAgentID(agentSecret);
    const localNode = new LocalNode(
      agentSecret,
      crypto.newRandomSessionID(agentID),
      crypto,
    );

    mkdirSync(path.dirname(dbPath), { recursive: true });
    localNode.setStorage(getBetterSqliteStorage(dbPath));
    localNode.enableGarbageCollector();

    const server = createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200);
        res.end("ok");
        return;
      }

      res.writeHead(404);
      res.end();
    });
    const websocketServer = new WebSocketServer({ noServer: true });
    const connections = new Set<WebSocket>();

    websocketServer.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      connections.add(ws);

      const pingIntervalId = setInterval(() => {
        if (ws.readyState !== NodeWebSocket.OPEN) {
          return;
        }

        try {
          ws.send(
            JSON.stringify({
              type: "ping",
              time: Date.now(),
              dc: "desktop-relay",
            }),
          );
        } catch {
          // ignore failed pings while the socket is shutting down
        }
      }, 1500);

      ws.on("close", () => {
        clearInterval(pingIntervalId);
        connections.delete(ws);
      });

      const clientAddress =
        (req.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() || req.socket.remoteAddress;
      const clientId = `${clientAddress ?? "unknown"}@${new Date().toISOString()}`;

      localNode.syncManager.addPeer(
        createWebSocketPeer({
          id: clientId,
          role: "client",
          websocket: ws,
          expectPings: false,
          batchingByDefault: false,
          deletePeerStateOnClose: true,
        }),
      );

      ws.on("error", (error: Error) => {
        console.error(`Error on connection ${clientId}:`, error);
      });
    });

    server.on("upgrade", (req, socket, head) => {
      if (req.url === "/health") {
        socket.destroy();
        return;
      }

      websocketServer.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        websocketServer.emit("connection", ws, req);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const handleError = (error: unknown) => {
        server.off("listening", handleListening);
        reject(error);
      };
      const handleListening = () => {
        server.off("error", handleError);
        resolve();
      };

      server.once("error", handleError);
      server.once("listening", handleListening);
      server.listen(port, DEFAULT_LOCAL_SYNC_BIND_HOST);
    });

    this.server = server;
    this.websocketServer = websocketServer;
    this.localNode = localNode;
    this.connections = connections;

    const parentConfig = resolveParentSyncPeerConfig();
    this.parentPeer = parentConfig.peer;
    if (parentConfig.error) {
      this.parentStatus = "error";
      this.parentConnected = false;
      this.parentError = parentConfig.error;
      this.hasConnectedToParent = false;
    } else if (parentConfig.peer) {
      this.attachParentPeer(localNode, parentConfig.peer);
    } else {
      this.parentStatus = "stopped";
      this.parentConnected = false;
      this.parentError = null;
      this.hasConnectedToParent = false;
    }
  }

  private cleanupRelayResources() {
    this.stopParentPeer(false);

    for (const connection of this.connections) {
      try {
        connection.close();
      } catch {
        // ignore teardown failures
      }
    }
    this.connections.clear();

    try {
      this.websocketServer?.close();
    } catch {
      // ignore teardown failures
    }
    this.websocketServer = null;

    try {
      this.localNode?.gracefulShutdown();
    } catch {
      // ignore teardown failures
    }
    this.localNode = null;
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
    this.startPromise = this.createRelayServer({ port, dbPath })
      .then(() => {
        this.error = null;
        this.refreshMdnsAdvertisements();
        this.emitStatusChange();
        return this.getStatus();
      })
      .catch((error: unknown) => {
        this.cleanupRelayResources();
        try {
          this.server?.close();
        } catch {
          // ignore teardown failures
        }
        this.server = null;
        this.error = error instanceof Error ? error.message : "Could not start local sync server.";
        this.emitStatusChange();
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
      this.cleanupRelayResources();
      const status = this.getStatus();
      this.emitStatusChange();
      return status;
    }

    const currentServer = this.server;
    this.server = null;
    this.error = null;
    this.unpublishMdnsAdvertisements();
    this.cleanupRelayResources();

    try {
      currentServer.close();
    } catch (error) {
      this.error = error instanceof Error ? error.message : "Could not stop local sync server.";
      const status = this.getStatus();
      this.emitStatusChange();
      return status;
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

    const status = this.getStatus();
    this.emitStatusChange();
    return status;
  }

  destroy() {
    this.cleanupRelayResources();
    this.unpublishMdnsAdvertisements();
    this.bonjour.destroy();
  }
}
