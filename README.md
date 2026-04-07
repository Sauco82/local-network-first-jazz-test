# local-network-first-jazz

A [Jazz](https://jazz.tools)-powered mini-framework for building local-network-first apps that do no force authentication on the users by default.

## The problem

The way in which we build many apps nowadays doesn't make much sense.

Imagine a small app, a tic-tac-toe game meant to be played with someone sitting next to you. From the user perspective something that should only require opening the app, finding your friend and starting to play over the network that you both are connected to.

But instead users are forced to create an account, find a way to manage our password that works cross device and browser, and then instead sending the movements directly to the other player who is in front of you, have them going into a roundtrip over hundreds of kilometers to the server and back.

Also, if at some point tic-tac-toe corp goes down, or decides that is time to switch to a pay-per-tic model. Users can say goodbye to keep on playing their game like they used to.

One of the saddest parts of this is that as a developer it also makes sense to develop apps this way, it is far easier to get your usual framework and set of cloud tools working to achieve this cross-device collaboration than it is to implement from scratch a local-network-first approach.

## What this is

This mini-framework is a proof of concept to try to make it easier to implement this local-network-first approach, in the shape of the aforementioned tic-tac-toe game.

At this point in time the UX of the game is abysmal, but still it is a better example of how this model can be used than explaining the model itself.

There are two main parts to this mini-framework:

1. Passwordless authentication
2. Local network sync

### Passwordless authentication

All data in [Jazz](https://jazz.tools) is encrypted and associated to an account by design, because of that even if you don't authenticate there is always at least an anonymous account associated to your device browser by default when opening the app.

The way [CoValues](https://jazz.tools/docs/react/core-concepts/covalues/overview) are accessed and updated in Jazz is [based on permissions](https://jazz.tools/docs/react/permissions-and-sharing/overview). Taking advantage of that we can treat the anonymous account as a user **device**, which in Jazz terms is simply an account with access to UserData. The **user** is simply data that is shared across several devices.

Most of the core logic in the following bit of the `schema.ts` file:

```ts
export const SharedUserData = co.map({
  name: z.string(),
  devices: co.list(co.account()),
  games: co.list(GameData),
});

export const UserData = co.map({
  userData: SharedUserData.optional(),
});

export const DeviceAccount = co.account({
  root: UserData,
  profile: co.profile(),
});
```

`SharedUserData` is the Value that is shared across all the devices of a single user. `name` would represent the name of the user and `devices` would be the list of devices part of the user. `games` on the other hand is specific to the tic-tac-toe and it is an example of the kind of shared data that could be stored in the `SharedUserData` value.

Creating or assigning a new `SharedUserData` basically represents either creating a new user or joining an existing one.

### Local network sync

[Jazz](https://jazz.tools) is not a traditional database in the sense that there is not a single place of storage. Instead, there is data that is shared across several several nodes and kept in sync through CoJSON.

In a default Jazz setup if a client makes changes those propagate to the node of the sync server, if the server contains unsynced changes that other clients are currently accessing those will be propagated to the clients as well.

In this new setup we are just adding yet another node, the local network node. The local network node is still connected to the cloud, that way we can still propagate changes coming from different networks.

The core of this solution is in `localSyncServer.ts`, a modified version of the [Jazz sync server](https://github.com/garden-co/jazz/blob/main/packages/jazz-run/src/startSyncServer.ts). The key difference on this one is having an upstream connection to the cloud sync server on top of the normal sync server.

### The rest

There is a lot more logic in this repo, but it is mostly related to the UI and handling the connectivity of the app.

This particular example is built to allow dynamic sync server switching, the creation of mDNS-advertised servers and the saving of preferred sync servers to the browser's local storage. But they are not strictly necessary nor the advised approach for every app.

## Gotchas

### The local sync server

The local sync server can only be started from the desktop app. This doesn't mean that a desktop app requires to be running a server to work as it can simply connect to other local server by entering its name.

Having a local sync server running implies duplicating the stored data in the device since both the mounted server and the desktop app are considered different clients and each has its own copy of the data.

Browsers can decide to clear up the local storage, only sync servers are a reliable way to keep the data. If the data that we generated in a barely used local network is not propagated to the cloud or to the sync servers we normally use that data could be lost.

### What about mobile apps?

In theory we could do the same that we did with desktop apps with mobile apps. Haven't gone deep about it but it seems that the most advisable approach is to create a mobile server with Tauri 2 to save in battery, memory and CPU usage.

### Web app

Currently the web app cannot connect to the local sync server and simply relies on the fact that the data is going to end up in the cloud.

This is due to the fact that the local sync is going to be done through a `ws` instead of a `wss` and will result in either security warnings or the inability to connect to the server.

There are ways this issue could be handled, but it is out of the scope of this project

## Dev stuff

### Requirements

- **Node.js** (use a current LTS that matches your machine).
- **pnpm** `10.6.5` (see `[package.json](package.json)` `packageManager`).
- For **Electron** and `**better-sqlite3`\*\*

### Install and scripts

From the repo root:

```bash
pnpm install
pnpm dev          # Vite on 127.0.0.1:5173 + Electron dev (desktop waits for web)
pnpm dev:web      # Web only
pnpm dev:desktop  # Web (strict port) + desktop, same as dev
pnpm build
pnpm typecheck    # also available as pnpm lint
```

If native modules break after a Node/Electron bump:

```bash
pnpm --filter @repo/desktop rebuild:native
```

### Monorepo layout

| Path                             | Role                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| `[apps/web](apps/web)`           | Vite + React entry                                                   |
| `[apps/desktop](apps/desktop)`   | Electron shell, preload/IPC, local sync service                      |
| `[packages/app](packages/app)`   | Shared app: routes, sync settings UI, runtime detection              |
| `[packages/jazz](packages/jazz)` | Jazz provider, `DeviceAccount` schema (incl. tic-tac-toe `GameData`) |
| `[packages/ui](packages/ui)`     | Shared UI components                                                 |

Builds are orchestrated with **Turbo** (`[turbo.json](turbo.json)`); workspaces are in `[pnpm-workspace.yaml](pnpm-workspace.yaml)`.

### Environment variables

**Web** — copy `[apps/web/.env.example](apps/web/.env.example)` to `apps/web/.env` (or `.env.local`):

- `VITE_JAZZ_API_KEY` — passed into the app; used with the default **cloud** sync URL when that target is selected.

**Desktop / local sync server** (see `[apps/desktop/src/localSyncServer.ts](apps/desktop/src/localSyncServer.ts)`):

- `JAZZ_API_KEY` or `VITE_JAZZ_API_KEY` — influence the default parent (cloud) peer when configured.
- `JAZZ_LOCAL_SYNC_PORT` — local sync port (default `4200`).
- `JAZZ_PARENT_SYNC_PEER` — optional full `ws://` or `wss://` URL for parent sync.

### Sync targets in the UI

The in-app **Jazz config** card (desktop) lets you pick a reachable peer: **cloud**, **loopback** to this desktop’s local server, **mDNS-advertised** peers, or **saved** URLs. Jazz mounts only after a **working** peer is selected and probed.

### Production-ish desktop builds

With `VITE_DEV_SERVER_URL` unset, Electron loads the built web bundle from `[apps/web/dist](apps/web)` (see `[apps/desktop/src/main.ts](apps/desktop/src/main.ts)`). Run `pnpm build` from the root so dependents build in the right order.
