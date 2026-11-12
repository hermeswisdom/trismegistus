import { useEffect, useMemo, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  BONACCI_QUOTE,
  BONACCI_ROWS,
  CALLOUT_BODY,
  CALLOUT_LEAD,
  CORE_NAMES,
  DEEPER_ROUTES,
  DEEPER_SOURCE_KEYS,
  EDGE_TYPES,
  EDGES,
  ENTRIES,
  EVIDENCE_LAYERS,
  EXTRA_ALIASES,
  FURTHER_READING,
  GROUPS,
  HERMES_DESCRIPTION,
  HERMES_TITLE,
  IDRIS_QUOTES,
  IDRIS_ROWS,
  METHOD_BOUNDARIES,
  METHOD_EDITORIAL,
  METHOD_ROWS,
  METHOD_SCOPE,
  PERIODS,
  READINGS,
  REFS,
  SOURCE_KEYS,
  STORY_IDS,
  SYMBOL_ROWS,
  TIMELINE_ROWS,
  TOC,
  TOURS,
  TRADITION_NAMES,
  WISDOM_THEMES,
  dateText,
  entryById,
  groupColor,
  layerOf,
  normalise,
  otherEnd,
  sourceOf,
  traditionsOf,
  type Entry,
  type Edge,
} from "@/lib/hermes-atlas";
import { Network } from "./network";
import { Picture } from "./picture";
import {
  AtlasButton,
  AtlasInput,
  AtlasSelect,
  AtlasTable,
  Callout,
  ChipButton,
  Grid,
  LinkCards,
  Page,
  Properties,
  Quote,
  Section,
  Segmented,
  TableOfContents,
  Text,
  Toggle,
} from "./primitives";
import { atlasTheme } from "./theme";
import { cn } from "@/lib/utils";

function useHoverCapable() {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCapable(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return capable;
}

function LinkedText({
  text,
  selected,
  aliases,
  pattern,
  openFigure,
}: {
  text: string;
  selected: string;
  aliases: Map<string, string>;
  pattern: RegExp;
  openFigure: (id: string) => void;
}) {
  return (
    <>
      {text.split(pattern).map((part, index) => {
        const id = aliases.get(normalise(part));
        if (id && id !== selected) {
          return (
            <button
              key={index}
              type="button"
              title={`Inspect ${entryById(id).name}`}
              onClick={() => openFigure(id)}
              className="inline border-0 border-b border-dotted border-subtle bg-transparent p-0 font-sans text-fg hover:text-accent"
            >
              {part}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function InspectCard({
  entry,
  connections,
  linked,
  openFigure,
  compact,
}: {
  entry: Entry;
  connections: Edge[];
  linked: (text: string) => ReactNode;
  openFigure: (id: string) => void;
  compact: boolean;
}) {
  const relatedIds = Array.from(new Set(connections.map((edge) => otherEnd(edge, entry.id))));
  return (
    <div className="min-w-0">
      {!compact ? null : (
        <h3 className="font-display text-xl text-fg">Inspect · {entry.name}</h3>
      )}
      <Properties
        items={
          compact
            ? [
                { label: "Layer", value: layerOf(entry) },
                { label: "Tradition", value: traditionsOf(entry).join(" · ") },
                { label: "Era", value: entry.era },
              ]
            : [
                { label: "Evidence layer", value: layerOf(entry) },
                { label: "Browse threads", value: traditionsOf(entry).join(" · ") },
                { label: "Tradition / culture", value: entry.group },
                { label: "Era / evidence", value: entry.era },
                { label: "Claim category", value: entry.status },
                { label: "Symbols & ideas", value: entry.symbols },
                {
                  label: "Timeline convention",
                  value:
                    entry.year === null
                      ? "Exact origin/composition date is not established here. See the era description; no precise date is invented."
                      : `${dateText(entry.year)} is an approximate plotting anchor, not necessarily a birth or first-attestation date.`,
                },
                { label: "Connections recorded", value: String(EDGES.filter((e) => e.a === entry.id || e.b === entry.id).length) },
              ]
        }
      />
      <div className="mt-4 text-sm leading-relaxed text-muted">{linked(entry.summary)}</div>
      {compact ? (
        <details className="mt-3">
          <summary className="cursor-pointer py-3 text-fg">
            Expand story, symbols and connection notes · map stays open
          </summary>
          <p className="leading-relaxed text-muted">{linked(entry.story)}</p>
          <p className="mt-2 text-sm leading-relaxed text-subtle">{entry.symbols}</p>
          {connections.map((edge, i) => {
            const id = otherEnd(edge, entry.id);
            return (
              <div key={i} className="border-t border-border py-2.5">
                <ChipButton onClick={() => openFigure(id)}>{entryById(id).name}</ChipButton>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  {edge.type} · {linked(edge.note)}
                </p>
              </div>
            );
          })}
        </details>
      ) : (
        <p className="mt-4 leading-relaxed text-fg">{linked(entry.story)}</p>
      )}
      {compact ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {relatedIds.slice(0, 8).map((id) => (
              <ChipButton key={id} className="px-2.5 py-1.5 text-[13px]" onClick={() => openFigure(id)}>
                {entryById(id).name.split(" / ")[0]}
              </ChipButton>
            ))}
          </div>
          <div className="mt-3">
            <LinkCards links={entry.refs.slice(0, 2).map((key) => sourceOf(key))} />
          </div>
        </>
      ) : null}
    </div>
  );
}

export function HermesAtlas() {
  const hoverEnabled = useHoverCapable();
  const [selected, setSelected] = useState("hermes");
  const [query, setQuery] = useState("");
  const [culture, setCulture] = useState("All traditions");
  const [kind, setKind] = useState("All connections");
  const [mode, setMode] = useState("Follow a figure");
  const [offset, setOffset] = useState(0);
  const [period, setPeriod] = useState(-1);
  const [labels, setLabels] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [tab, setTab] = useState("Stories");
  const [tradition, setTradition] = useState("All threads");
  const [layer, setLayer] = useState("All evidence layers");
  const [history, setHistory] = useState<string[]>(["hermes"]);
  const [tour, setTour] = useState(0);
  const [step, setStep] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tapPreview, setTapPreview] = useState<string | null>(null);

  const s = entryById(selected);
  const related = EDGES.filter((edge) => edge.a === selected || edge.b === selected);
  const allowed = ENTRIES.filter(
    (entry) =>
      (culture === "All traditions" || entry.group === culture) &&
      (tradition === "All threads" || traditionsOf(entry).includes(tradition)) &&
      (layer === "All evidence layers" || layerOf(entry) === layer) &&
      (kind === "All connections" ||
        EDGES.some((edge) => (edge.a === entry.id || edge.b === entry.id) && edge.type === kind)),
  ).map((entry) => entry.id);
  const results = ENTRIES.filter(
    (entry) =>
      allowed.includes(entry.id) &&
      (!query.trim() ||
        normalise(`${entry.name} ${entry.summary} ${entry.symbols} ${entry.group}`).includes(normalise(query))),
  );

  const aliases = useMemo(() => {
    const map = new Map<string, string>();
    ENTRIES.forEach((entry) =>
      entry.name.split(" / ").forEach((alias) => {
        const name = alias.split(" · ")[0]!.trim();
        if (name.length >= 4 && !map.has(normalise(name))) map.set(normalise(name), entry.id);
      }),
    );
    EXTRA_ALIASES.forEach(([name, id]) => map.set(normalise(name), id));
    if (s.group === "Hermetic & Hellenistic" && s.id !== "hermanubis") {
      map.set("asclepius", "asclepius-pupil");
    }
    return map;
  }, [s.group, s.id]);

  const linkPattern = useMemo(() => {
    const esc = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `\\b(${Array.from(aliases.keys())
        .sort((a, b) => b.length - a.length)
        .map(esc)
        .join("|")})\\b`,
      "gi",
    );
  }, [aliases]);

  const linked = (text: string) => (
    <LinkedText
      text={text}
      selected={selected}
      aliases={aliases}
      pattern={linkPattern}
      openFigure={openFigure}
    />
  );

  function choose(id: string) {
    setSelected(id);
    setHistory((h) => (h[h.length - 1] === id ? h : [...h, id].slice(-16)));
    setOffset(0);
    setPeriod(-1);
    setLabels(true);
    setSheetOpen(true);
    setTapPreview(hoverEnabled ? null : id);
  }

  function openFigure(id: string) {
    setCulture("All traditions");
    setTradition("All threads");
    setLayer("All evidence layers");
    setKind("All connections");
    setQuery("");
    choose(id);
    setFocusKey((value) => value + 1);
  }

  function search(value: string) {
    setQuery(value);
    if (value.trim()) {
      setCulture("All traditions");
      setTradition("All threads");
      setLayer("All evidence layers");
      setKind("All connections");
      setPeriod(-1);
      const exact = ENTRIES.find((entry) =>
        entry.name.split(" / ").some((alias) => normalise(alias) === normalise(value)),
      );
      if (exact) {
        setMode("Follow a figure");
        choose(exact.id);
      }
    }
  }

  function visitHistory(i: number) {
    const id = history[i]!;
    setHistory(history.slice(0, i + 1));
    setSelected(id);
    setCulture("All traditions");
    setTradition("All threads");
    setLayer("All evidence layers");
    setKind("All connections");
    setQuery("");
    setOffset(0);
    setPeriod(-1);
    setFocusKey((value) => value + 1);
    setSheetOpen(true);
  }

  function runStep(i: number) {
    const route = TOURS[tour]!;
    const k = Math.max(0, Math.min(route.ids.length - 1, i));
    setStep(k);
    setMode("Follow a figure");
    openFigure(route.ids[k]!);
  }

  const connections = related.filter((edge) => kind === "All connections" || edge.type === kind);
  const eligibleNeighbours = related
    .filter((edge) => kind === "All connections" || edge.type === kind)
    .map((edge) => otherEnd(edge, selected))
    .filter((id) => allowed.includes(id));

  function reset() {
    setTradition("All threads");
    setLayer("All evidence layers");
    setHistory(["hermes"]);
    setCulture("All traditions");
    setKind("All connections");
    setQuery("");
    setPeriod(-1);
    setOffset(0);
    setSelected("hermes");
    setMode("Follow a figure");
    setResetKey((value) => value + 1);
    setSheetOpen(false);
  }

  const extra = READINGS[selected];
  const currentTour = TOURS[tour]!;

  return (
    <Page title={HERMES_TITLE} summary={HERMES_DESCRIPTION}>
      <TableOfContents items={TOC} />
      <Callout lead={CALLOUT_LEAD}>{CALLOUT_BODY}</Callout>

      <Section heading="Explore the constellation" id="explore">
        <Text>
          Start with the key names below. IDRIS is a large node on Hermes's opening map, directly linked as a later
          traditional identification. “Follow a figure” shows twelve neighbours at a time; “Whole atlas” includes every
          entry. Drag to pan and pinch, scroll or use the zoom buttons. Search ignores case and accents; an exact name
          centres its node and clears restrictive filters.
        </Text>
        <div className="flex flex-wrap gap-2">
          {["hermes", ...CORE_NAMES].map((id) => (
            <AtlasButton
              key={id}
              label={id === "idris" ? "IDRIS · Islamic prophet" : entryById(id).name.split(" / ")[0]!}
              variant={id === "idris" ? "primary" : "quiet"}
              onClick={() => openFigure(id)}
            />
          ))}
          <AtlasButton
            label={`Browse all ${ENTRIES.length} names`}
            onClick={() => {
              setQuery("");
              setCulture("All traditions");
              setKind("All connections");
              setTradition("All threads");
              setLayer("All evidence layers");
              document.getElementById("index")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        </div>
        <Grid columns={3}>
          <AtlasInput
            label="Search names, stories or symbols"
            value={query}
            onChange={search}
            placeholder="Try Idris, writing, Mercury, alchemy…"
          />
          <AtlasSelect
            label="Tradition / culture"
            value={culture}
            onChange={(value) => {
              setCulture(value);
              setOffset(0);
            }}
            options={["All traditions", ...GROUPS]}
          />
          <AtlasSelect
            label="Connection type"
            value={kind}
            onChange={(value) => {
              setKind(value);
              setOffset(0);
            }}
            options={["All connections", ...EDGE_TYPES]}
          />
        </Grid>
        <Grid columns={2}>
          <AtlasSelect
            label="Tradition or specialist thread"
            value={tradition}
            onChange={(value) => {
              setTradition(value);
              setCulture("All traditions");
              setOffset(0);
              setMode("Whole atlas");
              if (value !== "All threads") {
                const first = ENTRIES.find(
                  (entry) =>
                    traditionsOf(entry).includes(value) &&
                    (layer === "All evidence layers" || layerOf(entry) === layer),
                );
                if (first) choose(first.id);
              }
            }}
            options={["All threads", ...TRADITION_NAMES]}
          />
          <AtlasSelect
            label="Evidence layer"
            value={layer}
            onChange={(value) => {
              setLayer(value);
              setOffset(0);
            }}
            options={["All evidence layers", ...EVIDENCE_LAYERS]}
          />
        </Grid>
        <Text>
          Evidence layers are browsing aids: “Attested history” means a cult, text, object or interpretation is
          documented—not that its gods or supernatural claims are proven. “Modern interpretation / fringe” includes
          documented modern esoteric creativity as well as unsupported provenance claims; it does not mean every modern
          author is fringe. Each panel gives the finer distinction.
        </Text>
        <AtlasSelect
          label="Jump directly to a name"
          value={selected}
          onChange={openFigure}
          options={ENTRIES.map((entry) => ({
            value: entry.id,
            label: `${entry.name} — ${entry.group}`,
          })).sort((a, b) => a.label.localeCompare(b.label))}
        />
        {query.trim() && results.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {results.map((entry) => (
              <ChipButton key={entry.id} onClick={() => openFigure(entry.id)}>
                {entry.name}
              </ChipButton>
            ))}
          </div>
        ) : null}

        <div aria-label="Browsing history" className="flex flex-wrap items-center gap-1.5">
          <AtlasButton
            label="← Back"
            disabled={history.length < 2}
            onClick={() => visitHistory(history.length - 2)}
          />
          {history.map((id, i) => (
            <ChipButton
              key={`${id}-${i}`}
              active={i === history.length - 1}
              className="px-2 py-1.5 text-xs"
              onClick={() => visitHistory(i)}
            >
              {i + 1}. {entryById(id).name.split(" / ")[0]}
            </ChipButton>
          ))}
        </div>

        <Section heading="Guided threads · explore one stop at a time" id="tours">
          <AtlasSelect
            label="Choose a guided route"
            value={String(tour)}
            onChange={(value) => {
              setTour(Number(value));
              setStep(0);
            }}
            options={TOURS.map((route, i) => ({ value: String(i), label: route.title }))}
          />
          <Text>
            {currentTour.note} Stops form a thematic reading route; not every consecutive pair has a direct graph edge.
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {currentTour.ids.map((id, i) => (
              <ChipButton key={id} active={i === step} className="text-[13px]" onClick={() => runStep(i)}>
                {i + 1}. {entryById(id).name.split(" / ")[0]}
              </ChipButton>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <AtlasButton label="Start this thread" onClick={() => runStep(0)} />
            <AtlasButton label="Previous stop" disabled={step === 0} onClick={() => runStep(step - 1)} />
            <AtlasButton
              label="Next stop"
              disabled={step === currentTour.ids.length - 1}
              onClick={() => runStep(step + 1)}
            />
          </div>
        </Section>

        <Segmented options={["Follow a figure", "Whole atlas"]} value={mode} onChange={(value) => { setMode(value); setOffset(0); }} />
        <Toggle label="Show map labels" value={labels} onChange={setLabels} />

        <div className="grid min-w-0 gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <Network
              selected={selected}
              select={choose}
              allowed={allowed}
              mode={mode}
              offset={offset}
              period={period}
              labels={labels}
              resetKey={resetKey}
              linkType={kind}
              focusKey={focusKey}
              hoverEnabled={hoverEnabled}
              onTapPreview={setTapPreview}
            />
            {!hoverEnabled && tapPreview ? (
              <p className="sr-only">
                Preview for {entryById(tapPreview).name}. Open the sheet for the full inspect panel.
              </p>
            ) : null}
          </div>
          <div className="hidden min-w-0 lg:block">
            <InspectCard
              entry={s}
              connections={connections}
              linked={linked}
              openFigure={openFigure}
              compact
            />
            <AtlasButton
              label="Full evidence panel & all sources"
              onClick={() => document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            />
          </div>
        </div>

        <Text>
          {mode === "Follow a figure"
            ? `${s.name}: ${Math.min(12, Math.max(0, eligibleNeighbours.length - offset))} of ${eligibleNeighbours.length} filtered neighbours shown.`
            : `${allowed.length} matching entries across labelled tradition lanes; hover for a preview, select a point to inspect without replacing the map. Zoom into a lane for names.`}{" "}
          Solid lines: recorded relationships, equivalences or transmission. Long dashes: traditional identifications.
          Dots: parallels only. Lines are not proof of common origin.
        </Text>
        <div className="flex flex-wrap gap-2">
          {mode === "Follow a figure" && eligibleNeighbours.length > 12 ? (
            <AtlasButton
              label={offset + 12 < eligibleNeighbours.length ? "Next neighbours" : "First neighbours"}
              onClick={() => setOffset(offset + 12 < eligibleNeighbours.length ? offset + 12 : 0)}
            />
          ) : null}
          <AtlasButton
            label={`Read ${s.name.split(" / ")[0]}`}
            variant="primary"
            onClick={() => {
              setSheetOpen(true);
              document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
          <AtlasButton label="Reset to Hermes" onClick={reset} />
          <span className="lg:hidden">
            <AtlasButton label="Open inspect sheet" onClick={() => setSheetOpen(true)} />
          </span>
        </div>
        <Text>Culture legend — colour belongs to the node, not to the strength of evidence.</Text>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((group) => (
            <ChipButton
              key={group}
              active={culture === group}
              onClick={() => {
                setCulture(culture === group ? "All traditions" : group);
                setOffset(0);
              }}
            >
              <span
                className="mr-2 inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: groupColor(group) }}
              />
              {group}
            </ChipButton>
          ))}
        </div>
      </Section>

      <Section heading="Selected figure & its links" id="detail">
        <Grid columns={2}>
          <div>
            <Picture kind={s.image} name={s.name} />
            <div className="mt-3 font-display text-2xl font-semibold text-fg">{s.name}</div>
            <p className="mt-3 leading-relaxed text-muted">{linked(s.summary)}</p>
            <p className="mt-3 leading-relaxed text-fg">{linked(s.story)}</p>
            <p className="mt-3 text-xs text-subtle">
              Original symbolic illustration, not a historical portrait or photograph. No depictions of prophets are
              used.
            </p>
          </div>
          <InspectCard entry={s} connections={connections} linked={linked} openFigure={openFigure} compact={false} />
        </Grid>
        {selected === "idris" ? (
          <Section heading="Idris · scripture, the fourth heaven & the sciences">
            {IDRIS_QUOTES.map((quote) => (
              <Quote key={quote.cite} cite={quote.cite}>
                {quote.text}
              </Quote>
            ))}
            <AtlasTable
              columns={["Layer of evidence", "Teaching / connection", "How to read it"]}
              rows={IDRIS_ROWS.map((row) => [...row])}
            />
          </Section>
        ) : null}
        {selected === "bonacci" ? (
          <Section heading="Santos Bonacci · his interpretation and the evidence">
            <Quote cite={BONACCI_QUOTE.cite}>{BONACCI_QUOTE.text}</Quote>
            <AtlasTable
              columns={["Theme", "What the consulted sources support", "Historical / scientific distinction"]}
              rows={BONACCI_ROWS.map((row) => [...row])}
            />
            <Text>
              The constellation is an original symbolic illustration in the Page's existing style, not a portrait. The
              2017 timeline anchor locates a dated essay during his contemporary teaching era; it is not a claim about
              when he first began lecturing. His work is placed in the modern interpretation layer without implying that
              all modern esoteric teachers hold the same views.
            </Text>
          </Section>
        ) : null}
        {extra ? (
          <Section heading={extra.heading}>
            <Text>{linked(extra.intro)}</Text>
            <AtlasTable
              columns={extra.columns}
              rows={extra.rows.map((row) => row.map((cell) => linked(cell)))}
            />
            <LinkCards links={extra.refs.map((key) => sourceOf(key))} />
          </Section>
        ) : null}
        {connections.length > 0 ? (
          <AtlasTable
            columns={["Connected name", "Link type", "What the connection actually says"]}
            rows={connections.map((edge) => {
              const id = otherEnd(edge, selected);
              return [
                <ChipButton key={id} onClick={() => choose(id)}>
                  {entryById(id).name}
                </ChipButton>,
                edge.type,
                linked(edge.note),
              ];
            })}
          />
        ) : null}
        <LinkCards
          links={s.refs.map((key) => ({ ...sourceOf(key), site: "Source / further reading" }))}
        />
      </Section>

      <Section heading="Master timeline" id="timeline">
        <Text>
          Choose an era to light up matching nodes on the map. Dates locate the evidence, text or reception
          discussed—not the literal lifetime of a god. Bands have equal visual weight, not equal duration. Living oral
          traditions are deliberately not squeezed into invented ancient dates.
        </Text>
        <div className="flex flex-wrap gap-2">
          <AtlasButton
            label="Highlight all eras"
            onClick={() => setPeriod(-1)}
            variant={period === -1 ? "primary" : "quiet"}
          />
          <AtlasButton
            label="Show map"
            onClick={() => document.getElementById("explore")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PERIODS.map((item, i) => (
            <div
              key={item.name}
              className="pt-3"
              style={{ borderTop: `3px solid ${period === i ? atlasTheme.accent : atlasTheme.border.default}` }}
            >
              <ChipButton
                className="w-full"
                active={period === i}
                onClick={() => setPeriod(period === i ? -1 : i)}
              >
                {item.label} · {item.name}
              </ChipButton>
              <p className="mt-2 text-sm leading-relaxed text-muted">{item.note}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ENTRIES.filter(
                  (entry) => entry.year !== null && entry.year >= item.range[0]! && entry.year <= item.range[1]!,
                ).map((entry) => (
                  <ChipButton
                    key={entry.id}
                    className="px-2.5 py-1.5 text-[13px]"
                    onClick={() => {
                      openFigure(entry.id);
                      setPeriod(i);
                    }}
                  >
                    {entry.name.split(" / ")[0]}
                  </ChipButton>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Section heading="Period-only and undated entries" collapsible defaultOpen={false}>
          <Text>
            These entries remain on the map and in search. Their era descriptions are retained without manufacturing a
            precise origin or composition date.
          </Text>
          <div className="flex flex-wrap gap-1.5">
            {ENTRIES.filter((entry) => entry.year === null).map((entry) => (
              <ChipButton key={entry.id} onClick={() => openFigure(entry.id)}>
                {entry.name} · {entry.era}
              </ChipButton>
            ))}
          </div>
        </Section>
        <AtlasTable
          columns={["Milestone", "Date", "Why it matters"]}
          rows={TIMELINE_ROWS.map((row) => [...row])}
        />
      </Section>

      <Section heading="Stories & wisdom themes" id="stories">
        <Segmented options={["Stories", "Wisdom themes"]} value={tab} onChange={setTab} />
        {tab === "Stories" ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {STORY_IDS.map((id) => {
              const entry = entryById(id);
              return (
                <article key={id} className="border-t border-border pt-4">
                  <Picture kind={entry.image} name={entry.name} />
                  <h3 className="mt-3 font-display text-xl text-fg">{entry.name}</h3>
                  <p className="text-xs text-subtle">{entry.status}</p>
                  <p className="mt-2 leading-relaxed text-muted">{linked(entry.story)}</p>
                  <div className="mt-3">
                    <ChipButton
                      onClick={() => {
                        choose(id);
                        document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      Explore story & sources
                    </ChipButton>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {WISDOM_THEMES.map((theme) => (
              <article key={theme.title} className="border-t border-border pt-4">
                <h3 className="font-display text-xl text-fg">{theme.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{theme.body}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {theme.ids.map((id) => (
                    <ChipButton
                      key={id}
                      onClick={() => {
                        choose(id);
                        document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                    >
                      {entryById(id).name.split(" / ")[0]}
                    </ChipButton>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section heading="Deeper Hermetic routes" id="deeper">
        <Text>
          Go beyond the familiar names through actual manuscripts, temple learning and documented receptions. Esoteric
          here describes a kind of teaching or interpretive tradition—not a guarantee that its supernatural claims are
          true.
        </Text>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {DEEPER_ROUTES.map((route) => (
            <article key={route.title} className="border-t border-border pt-4">
              <h3 className="font-display text-xl text-fg">{route.title}</h3>
              <p className="mt-2 leading-relaxed text-muted">{route.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {route.ids.map((id) => (
                  <ChipButton
                    key={id}
                    onClick={() => {
                      openFigure(id);
                      document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {entryById(id).name}
                  </ChipButton>
                ))}
              </div>
            </article>
          ))}
        </div>
        <Text>
          Not every proposed connection earns a line: no ancient Hermes–Quetzalcoatl identity is established here, and
          no unverified Atlantean lineage is presented as fact. The Kybalion's seven principles remain labelled as a
          modern 1908 system, separate from the ancient Hermetica.
        </Text>
        <LinkCards links={DEEPER_SOURCE_KEYS.map((key) => REFS[key]!)} />
      </Section>

      <Section heading="Symbols glossary" id="symbols">
        <AtlasTable
          columns={["Symbol", "Tradition / meaning", "Important distinction"]}
          rows={SYMBOL_ROWS.map((row) => [...row])}
        />
        <LinkCards
          links={[
            { title: "Hermes: attributes and ancient evidence", href: REFS.h!.href },
            { title: "Thoth: animal forms, scribal emblems and judgement", href: REFS.t!.href },
            { title: "Rod of Asclepius: the one-snake distinction", href: REFS.rod!.href },
          ]}
        />
      </Section>

      <Section heading="Browse every name" id="index">
        <Text>
          The index follows search, culture, specialist-thread, evidence-layer and connection-type filters above.
          Exact-name search clears restrictive filters; the direct-name selector always includes the entire atlas. Every
          entry has a short account, era, story, symbols and source links; select any name to load its details.
        </Text>
        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((entry) => (
              <ChipButton
                key={entry.id}
                active={selected === entry.id}
                className="flex-col items-start"
                onClick={() => {
                  choose(entry.id);
                  document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <span className="block font-semibold">{entry.name}</span>
                <span className="mt-1 block text-xs text-subtle">
                  {entry.group} · {entry.era}
                </span>
              </ChipButton>
            ))}
          </div>
        ) : null}
      </Section>

      <Section heading="How to read the evidence" id="method">
        <AtlasTable
          columns={["Link class", "What it establishes", "What it does not establish"]}
          rows={METHOD_ROWS.map((row) => [...row])}
        />
        <Text>{METHOD_SCOPE}</Text>
        <Text>{METHOD_BOUNDARIES}</Text>
        <Text>{METHOD_EDITORIAL}</Text>
      </Section>

      <Section heading="Sources & further reading" id="sources">
        <Text>
          Use each selected entry's sources for the specific connection. Start with these scholarly and primary-text
          routes; some academic links provide only an abstract without library access. Source traditions are evidence
          for what people believed, not automatic proof of a claimed primordial history.
        </Text>
        <LinkCards links={SOURCE_KEYS.map((key) => REFS[key]!)} numbered />
        <Text>{FURTHER_READING}</Text>
      </Section>

      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden transition-[opacity,visibility] duration-200",
          sheetOpen ? "visible opacity-100" : "invisible pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Close inspect sheet"
          className="absolute inset-0 bg-bg/70"
          onClick={() => setSheetOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="hermes-sheet-title"
          className={cn(
            "absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto overscroll-contain border-t border-border bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4",
            "transition-transform duration-200",
            sheetOpen ? "translate-y-0" : "translate-y-6",
          )}
        >
          <div className="mx-auto max-w-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs tracking-[0.22em] text-accent uppercase">Inspect</p>
                <h3 id="hermes-sheet-title" className="mt-1 font-display text-2xl text-fg">
                  {s.name}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSheetOpen(false)}
                className="flex size-11 shrink-0 items-center justify-center text-muted hover:text-fg"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4">
              <InspectCard
                entry={s}
                connections={connections}
                linked={linked}
                openFigure={openFigure}
                compact
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AtlasButton
                label="Full evidence panel & all sources"
                onClick={() => {
                  setSheetOpen(false);
                  document.getElementById("detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
              <AtlasButton label="Keep reading the map" onClick={() => setSheetOpen(false)} />
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
