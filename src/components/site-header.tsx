import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HermesNote } from "@/components/hermes-note";
import { cn } from "@/lib/utils";
import { usePlayer } from "@/lib/player-store";

const LINKS = [
  { href: "#work", label: "Wall" },
  { href: "#wheel", label: "Wheel" },
  { href: "#board", label: "Board" },
  { href: "#office", label: "Office" },
  { href: "#signal", label: "Signal" },
];

export function SiteHeader() {
  const entered = usePlayer((s) => s.entered);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-30 transition-[background-color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "opacity-100" : "pointer-events-none opacity-0",
        scrolled ? "bg-bg/80 shadow-[0_1px_0_0_rgb(214_226_74_/_18%)]" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a
          href="#top"
          className="flex items-center gap-2 font-display text-sm tracking-[0.14em] text-fg uppercase sm:text-lg sm:tracking-[0.16em]"
        >
          <HermesNote size="mark" />
          Trismegistus
        </a>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-[0.22em] text-muted uppercase transition-colors duration-150 hover:text-accent"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="relative flex size-11 items-center justify-center text-fg md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="relative size-5">
            <Menu
              className={cn(
                "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-200",
                open ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-none",
              )}
            />
            <X
              className={cn(
                "absolute inset-0 size-5 transition-[opacity,transform,filter] duration-200",
                open ? "scale-100 opacity-100 blur-none" : "scale-[0.25] opacity-0 blur-[4px]",
              )}
            />
          </span>
        </button>
      </div>
      <div
        className={cn(
          "fixed inset-0 top-16 z-20 bg-bg md:hidden transition-[opacity,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav className="flex flex-col px-6 py-8" aria-label="Mobile">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-border py-5 font-display text-3xl text-fg"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
