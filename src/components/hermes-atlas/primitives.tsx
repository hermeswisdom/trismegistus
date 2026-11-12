import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-transparent px-3 py-2 text-left text-sm leading-snug text-fg transition-colors duration-150 hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40";

export function Page({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <article className="hermes-atlas mx-auto w-full max-w-6xl min-w-0 px-5 pb-16 sm:px-8">
      <header className="max-w-4xl pt-6 sm:pt-10">
        <p className="text-xs tracking-[0.28em] text-accent uppercase">Atlas</p>
        <h1 className="hermes-atlas-title mt-3 font-display text-section text-fg">{title}</h1>
        <p className="mt-5 max-w-3xl text-lead text-muted">{summary}</p>
      </header>
      <div className="mt-10 flex min-w-0 flex-col gap-12 sm:gap-16">{children}</div>
    </article>
  );
}

export function Section({
  heading,
  id,
  collapsible = false,
  defaultOpen = true,
  children,
}: {
  heading: string;
  id?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const title = (
    <h2 id={id} className="font-display text-2xl tracking-tight text-fg sm:text-3xl">
      {heading}
    </h2>
  );
  if (collapsible) {
    return (
      <details
        className="min-w-0 border-t border-border pt-6"
        open={defaultOpen}
      >
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          {title}
        </summary>
        <div className="mt-5 flex min-w-0 flex-col gap-4">{children}</div>
      </details>
    );
  }
  return (
    <section className="min-w-0" aria-labelledby={id}>
      {title}
      <div className="mt-5 flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

export function Text({ children }: { children: ReactNode }) {
  return <p className="text-[0.975rem] leading-relaxed text-muted">{children}</p>;
}

export function Quote({ cite, children }: { cite: string; children: ReactNode }) {
  return (
    <blockquote className="border-l-2 border-accent/70 pl-4">
      <p className="font-display text-lg leading-relaxed text-fg sm:text-xl">{children}</p>
      <cite className="mt-3 block text-xs tracking-[0.14em] text-subtle not-italic uppercase">
        {cite}
      </cite>
    </blockquote>
  );
}

export function Callout({ lead, children }: { lead: string; children: ReactNode }) {
  return (
    <aside className="rounded-lg border border-accent/25 bg-elevated/80 px-4 py-4 shadow-[0_0_40px_rgb(214_226_74_/_8%)] sm:px-5">
      <p className="text-xs tracking-[0.22em] text-accent uppercase">{lead}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
    </aside>
  );
}

export function TableOfContents({
  items,
}: {
  items: readonly { label: string; id: string; depth?: number }[];
}) {
  return (
    <nav aria-label="On this page" className="border-y border-border py-4">
      <p className="text-xs tracking-[0.22em] text-subtle uppercase">Contents</p>
      <ol className="mt-3 flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className={item.depth ? "pl-4" : undefined}>
            <a
              href={`#${item.id}`}
              className="text-sm text-muted transition-colors duration-150 hover:text-accent"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Grid({ columns, children }: { columns: 2 | 3; children: ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-w-0 gap-4",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "lg:grid-cols-2",
      )}
    >
      {children}
    </div>
  );
}

export function Properties({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 border-t border-border pt-2">
          <dt className="text-[0.7rem] tracking-[0.18em] text-subtle uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm leading-relaxed text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LinkCards({
  links,
  numbered = false,
}: {
  links: { title: string; href: string; site?: string }[];
  numbered?: boolean;
}) {
  return (
    <ol className={cn("grid min-w-0 gap-2", numbered ? "list-decimal" : "list-none")}>
      {links.map((link) => (
        <li key={link.href} className="min-w-0">
          <a
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="block min-w-0 rounded-md border border-border px-3 py-3 text-sm text-fg transition-colors duration-150 hover:border-accent/50 hover:text-accent"
          >
            <span className="block font-medium break-words">{link.title}</span>
            {link.site ? (
              <span className="mt-1 block text-xs tracking-[0.14em] text-subtle uppercase">
                {link.site}
              </span>
            ) : null}
          </a>
        </li>
      ))}
    </ol>
  );
}

export function AtlasButton({
  label,
  onClick,
  variant = "quiet",
  disabled = false,
}: {
  label: string;
  onClick?: () => void;
  variant?: "primary" | "quiet";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        chip,
        variant === "primary" && "border-accent/70 bg-accent/10 text-accent hover:text-accent",
      )}
    >
      {label}
    </button>
  );
}

export function AtlasInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs tracking-[0.16em] text-subtle uppercase">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-md border border-border bg-surface px-3 font-sans text-sm tracking-normal text-fg normal-case outline-none placeholder:text-subtle focus:border-accent/60"
      />
    </label>
  );
}

export function AtlasSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (string | { value: string; label: string })[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-xs tracking-[0.16em] text-subtle uppercase">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 max-w-full rounded-md border border-border bg-surface px-3 font-sans text-sm tracking-normal text-fg normal-case outline-none focus:border-accent/60"
      >
        {options.map((option) => {
          const item = typeof option === "string" ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="tablist" className="flex min-w-0 flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={value === option}
          onClick={() => onChange(option)}
          className={cn(
            chip,
            value === option && "border-accent/70 bg-accent/10 text-accent",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(chip, "gap-3", value && "border-accent/70")}
    >
      <span
        className={cn(
          "inline-block size-2.5 rounded-full",
          value ? "bg-accent shadow-[0_0_10px_rgb(214_226_74_/_80%)]" : "bg-subtle",
        )}
      />
      {label}
    </button>
  );
}

export function AtlasTable({
  columns,
  rows,
  caption,
}: {
  columns: readonly string[];
  rows: ReactNode[][];
  caption?: string;
}) {
  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain rounded-md border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-border bg-surface">
            {columns.map((column) => (
              <th
                key={column}
                className="px-3 py-3 text-xs font-medium tracking-[0.14em] text-subtle uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-border/80 align-top last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-3 leading-relaxed text-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChipButton({
  children,
  onClick,
  active = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(chip, active && "border-accent/70 text-accent", className)}
    >
      {children}
    </button>
  );
}
