import { ArrowDownToLine } from "lucide-react";
import {
  EBOOK_CONTENTS,
  EBOOK_COVER,
  EBOOK_DESCRIPTION,
  EBOOK_FILES,
  EBOOK_NOTE,
  EBOOK_PAGES,
  EBOOK_PAGE_PATH,
  EBOOK_SOURCES_LINE,
  EBOOK_TITLE,
  formatMegabytes,
} from "@/lib/ebook";
import { countEbookDownload } from "@/lib/ebook-client";
import { cn } from "@/lib/utils";

/**
 * The free ebook. Deliberately unlike the paid master UI (buy-master.tsx):
 * no price, no checkout, plain same-origin file links.
 */

export function EbookCover({ className, eager = false }: { className?: string; eager?: boolean }) {
  return (
    <picture className={cn("block", className)}>
      <source
        type="image/webp"
        srcSet={`${EBOOK_COVER.webp480} 480w, ${EBOOK_COVER.webp960} 960w`}
        sizes="(min-width: 1024px) 16rem, (min-width: 640px) 11rem, 7rem"
      />
      <img
        src={EBOOK_COVER.jpg}
        width={EBOOK_COVER.width}
        height={EBOOK_COVER.height}
        alt={EBOOK_COVER.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="block aspect-[5/8] h-auto w-full object-cover shadow-[0_24px_60px_-24px_rgb(0_0_0_/_80%)]"
      />
    </picture>
  );
}

export function EbookDownloadButtons({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap", className)}>
      {EBOOK_FILES.map((file, i) => (
        <a
          key={file.format}
          href={file.path}
          download={file.fileName}
          type={file.contentType}
          data-ebook-download={file.format}
          onClick={() => countEbookDownload(file.format)}
          className={cn(
            "inline-flex h-12 touch-manipulation items-center justify-center gap-2 px-6 text-xs font-medium tracking-[0.2em] uppercase transition-[transform,opacity,box-shadow] duration-150 ease-out active:scale-[0.97] sm:w-fit",
            i === 0
              ? "bg-fg text-bg hover:opacity-90"
              : "hairline hairline-hover text-fg",
          )}
        >
          <ArrowDownToLine className="size-3.5" aria-hidden="true" />
          {file.label}
          <span className="sr-only"> ({formatMegabytes(file.bytes)})</span>
        </a>
      ))}
    </div>
  );
}

function FileFacts() {
  return (
    <p className="text-[0.7rem] tracking-[0.14em] text-subtle uppercase">
      {EBOOK_PAGES} pages ·{" "}
      {EBOOK_FILES.map((f) => `${f.format.toUpperCase()} ${formatMegabytes(f.bytes)}`).join(" · ")}
      {" "}· No sign-up
    </p>
  );
}

/** Home page section (below the wall), linked from the header as #ebook. */
export function FreeEbook() {
  return (
    <section id="ebook" className="scroll-mt-24 border-t border-border" aria-labelledby="ebook-title">
      <div className="mx-auto grid max-w-6xl grid-cols-[7rem_1fr] items-start gap-x-5 gap-y-7 px-5 py-16 sm:grid-cols-[11rem_1fr] sm:gap-x-10 sm:px-8 lg:grid-cols-[16rem_1fr] lg:gap-x-16 lg:py-28">
        <a href={EBOOK_PAGE_PATH} className="block sm:row-span-2" aria-label={`${EBOOK_TITLE}: about the free ebook`}>
          <EbookCover />
        </a>
        <div className="self-center sm:self-end">
          <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">Free ebook</p>
          <h2 id="ebook-title" className="mt-3 font-display text-section text-fg">
            {EBOOK_TITLE}
          </h2>
          <p className="mt-3 text-[0.7rem] tracking-[0.22em] text-muted uppercase">{EBOOK_NOTE}</p>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:col-start-2">
          <p className="max-w-xl text-sm leading-relaxed text-muted sm:text-base">{EBOOK_DESCRIPTION}</p>
          <EbookDownloadButtons className="mt-7" />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <FileFacts />
            <a
              href={EBOOK_PAGE_PATH}
              className="w-fit text-[0.7rem] tracking-[0.14em] text-muted uppercase underline decoration-border underline-offset-4 transition-colors duration-150 hover:text-accent"
            >
              What’s inside
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** The /ebook page body. */
export function EbookPageBody() {
  return (
    <div className="grid items-start gap-10 sm:grid-cols-[13rem_1fr] sm:gap-12 lg:grid-cols-[18rem_1fr] lg:gap-16">
      <EbookCover eager className="mx-auto w-44 sm:mx-0 sm:w-full" />
      <div>
        <p className="text-xs font-medium tracking-[0.32em] text-accent uppercase">Free ebook</p>
        <h1 className="mt-3 font-display text-section text-fg">{EBOOK_TITLE}</h1>
        <p className="mt-3 text-[0.7rem] tracking-[0.22em] text-muted uppercase">{EBOOK_NOTE}</p>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted sm:text-base">{EBOOK_DESCRIPTION}</p>
        <EbookDownloadButtons className="mt-8" />
        <div className="mt-4">
          <FileFacts />
        </div>
        <h2 className="mt-12 text-xs font-medium tracking-[0.28em] text-subtle uppercase">Inside</h2>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {EBOOK_CONTENTS.map((part, i) => (
            <li key={part.title} className="grid grid-cols-[2.25rem_1fr] gap-2 py-4">
              <span className="font-display text-sm text-subtle">{["I", "II", "III", "IV"][i]}</span>
              <div>
                <p className="font-display text-lg text-fg">{part.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{part.note}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 max-w-xl text-xs leading-relaxed text-subtle">{EBOOK_SOURCES_LINE}</p>
      </div>
    </div>
  );
}
