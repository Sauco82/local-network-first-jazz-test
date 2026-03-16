import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren } from "react";

export function AppShell({
  children,
  eyebrow,
  title,
  subtitle,
}: PropsWithChildren<{
  eyebrow: string;
  title: string;
  subtitle: string;
}>) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-8 text-slate-100 md:px-10">
      <header className="space-y-4">
        <span className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.32em] text-cyan-200">
          {eyebrow}
        </span>
        <div className="space-y-3">
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
            {title}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            {subtitle}
          </p>
        </div>
      </header>
      {children}
    </main>
  );
}

export function Card({ children }: PropsWithChildren) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      {children}
    </section>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" }>) {
  const toneClass =
    tone === "success"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
      : tone === "warning"
        ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
        : "border-white/15 bg-white/5 text-slate-200";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60 ${
        props.className ?? ""
      }`}
    />
  );
}
