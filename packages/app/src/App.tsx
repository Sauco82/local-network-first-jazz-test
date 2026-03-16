import { useMemo, useState } from "react";
import { JazzAppProvider, resolveJazzApiKey, useTodoAccount } from "@repo/jazz";
import { AppShell, Badge, Button, Card, TextField } from "@repo/ui";

type AppRuntime = "web" | "desktop";

export function App({ apiKey, runtime }: { apiKey?: string; runtime: AppRuntime }) {
  return (
    <JazzAppProvider apiKey={apiKey}>
      <TodoWorkspace apiKey={apiKey} runtime={runtime} />
    </JazzAppProvider>
  );
}

function TodoWorkspace({
  apiKey,
  runtime,
}: {
  apiKey?: string;
  runtime: AppRuntime;
}) {
  const account = useTodoAccount();
  const [title, setTitle] = useState("");

  const runtimeLabel = runtime === "desktop" ? "Electron desktop" : "Vite web";
  const effectiveApiKey = useMemo(() => resolveJazzApiKey(apiKey), [apiKey]);

  const handleCreate = () => {
    const nextTitle = title.trim();

    if (!account.$isLoaded || nextTitle.length === 0) {
      return;
    }

    account.root.todos.$jazz.push({
      title: nextTitle,
      done: false,
      createdAt: Date.now(),
    });
    setTitle("");
  };

  return (
    <AppShell
      eyebrow="Local-first starter"
      title="One shared React app running on the web and in Electron."
      subtitle="This monorepo ships a single UI through Vite for the browser and reuses that exact renderer inside an Electron shell, with Jazz handling local-first persistence and sync."
    >
      <section className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>{runtimeLabel}</Badge>
            <Badge tone={account.$isLoaded ? "success" : "warning"}>
              {account.$isLoaded ? "Jazz account ready" : "Loading Jazz account"}
            </Badge>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
            <TextField
              value={title}
              placeholder="Write a task that should sync everywhere"
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleCreate();
                }
              }}
            />
            <Button
              disabled={!account.$isLoaded || title.trim().length === 0}
              type="button"
              onClick={handleCreate}
            >
              Add item
            </Button>
          </div>

          <div className="mt-6 grid gap-3">
            {!account.$isLoaded ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                Bootstrapping your Jazz account and syncing context.
              </div>
            ) : account.root.todos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                Your shared list is empty. Add the first item in the browser or desktop app.
              </div>
            ) : (
              account.root.todos
                .slice()
                .sort((left, right) => right.createdAt - left.createdAt)
                .map((todo) => (
                  <button
                    key={todo.$jazz.id}
                    className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-left transition hover:border-cyan-400/50"
                    type="button"
                    onClick={() => todo.$jazz.set("done", !todo.done)}
                  >
                    <span className={todo.done ? "text-slate-500 line-through" : "text-slate-100"}>
                      {todo.title}
                    </span>
                    <Badge tone={todo.done ? "success" : "default"}>
                      {todo.done ? "Done" : "Open"}
                    </Badge>
                  </button>
                ))
            )}
          </div>
        </Card>

        <div className="grid gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-white">Workspace wiring</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>`apps/web` serves the renderer with Vite and Tailwind.</p>
              <p>`apps/desktop` wraps that same renderer in an Electron window.</p>
              <p>`packages/jazz` owns the schema, provider, and account hook.</p>
              <p>`packages/app` owns the shared React UI.</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-white">Jazz configuration</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <p>
                Current key: <span className="font-medium text-cyan-200">{effectiveApiKey}</span>
              </p>
              <p>
                Put your own value in <code>apps/web/.env</code> as{" "}
                <code>VITE_JAZZ_API_KEY</code> to replace the starter fallback.
              </p>
              {account.$isLoaded ? (
                <p>
                  Account id:{" "}
                  <span className="break-all font-mono text-xs text-slate-400">
                    {account.$jazz.id}
                  </span>
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}
