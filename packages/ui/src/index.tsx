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
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-5 text-slate-900 md:px-6">
      <header className="space-y-1.5">
        <span className="inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {eyebrow}
        </span>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-600 md:text-sm">{subtitle}</p>
        </div>
      </header>
      {children}
    </main>
  );
}

export function Card({ children }: PropsWithChildren) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm md:p-4">{children}</section>
  );
}

export function Badge({
  children,
  tone = "default",
}: PropsWithChildren<{ tone?: "default" | "success" | "warning" }>) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none ${
        props.className ?? ""
      }`}
    />
  );
}

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 ${
        props.className ?? ""
      }`}
    />
  );
}
