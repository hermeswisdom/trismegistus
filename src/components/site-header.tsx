import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountLink } from "@/components/account-menu";
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
        "fixed inset-x-0 top-0 z-30 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        entered ? "opacity-100" : "pointer-events-none opacity-0",
        scrolled ? "bg-bg/80 shadow-[0_1px_0_0_rgb(214_226_74_/_18%)]" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:h-16 sm:px-8">
        <a
          href="#top"
          className="flex min-h-11 items-center gap-2 font-display text-sm tracking-[0.14em] text-fg uppercase sm:text-lg sm:tracking-[0.16em]"
        >
          <HermesNote size="mark" />
          Atman Music
        </a>
        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracking-[0.22em] text-muted uppercase transition-colors duration-150 hover:text-accent"
            >
              {link.label}
            </a>
          ))}
          <AccountLink />
        </nav>
        <button
          type="button"
          className="relative flex size-11 touch-manipulation items-center justify-center text-fg lg:hidden"
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
          "fixed inset-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-20 bg-bg lg:hidden transition-[opacity,visibility] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
          open ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
        )}
      >
        <nav className="flex flex-col px-6 py-8 pb-[calc(8rem+env(safe-area-inset-bottom))]" aria-label="Mobile">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="min-h-14 border-b border-border py-5 font-display text-3xl text-fg"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-8">
            <p className="text-xs tracking-[0.28em] text-subtle uppercase">The name</p>
            <div className="mt-4">
              <AccountLink
                className="items-start font-display text-3xl normal-case tracking-normal text-fg"
                onNavigate={() => setOpen(false)}
              />
            </div>
          </div>
        </nav>
      </div>
    </header>
  );
}
