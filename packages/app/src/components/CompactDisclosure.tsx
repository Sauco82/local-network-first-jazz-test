import type { ReactNode } from "react";

export function CompactDisclosure({
  id,
  title,
  hintWhenCollapsed,
  badge,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  hintWhenCollapsed?: string;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50/80">
      <button
        type="button"
        id={`${id}-trigger`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-white/80"
        onClick={onToggle}
      >
        <span className="shrink-0 text-[10px] text-slate-400" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
        <span className="shrink-0 font-medium text-slate-800">{title}</span>
        {badge}
        {hintWhenCollapsed && !open ? (
          <span className="ml-auto min-w-0 truncate pl-1 text-[10px] text-slate-500">{hintWhenCollapsed}</span>
        ) : null}
      </button>
      {open ? (
        <div id={`${id}-panel`} role="region" className="border-t border-slate-200/80 bg-white px-2.5 py-2">
          {children}
        </div>
      ) : null}
    </div>
  );
}
