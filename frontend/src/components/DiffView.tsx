import { diffWords } from "diff";

import { sectionText } from "@/lib/resumeText";
import { ALL_SECTIONS, type Resume, type SectionName } from "@/lib/types";

function InlineDiff({ before, after }: { before: string; after: string }) {
  return (
    <>
      {diffWords(before, after).map((part, i) =>
        part.added ? (
          <ins key={i} className="rounded bg-emerald-100 px-0.5 text-emerald-900 no-underline">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={i} className="rounded bg-rose-100 px-0.5 text-rose-800 decoration-rose-400">
            {part.value}
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9+#%]+/g) ?? []);
}

function similarity(a: string, b: string): number {
  const wa = words(a);
  const wb = words(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / Math.max(1, Math.min(wa.size, wb.size));
}

/** Pair each new bullet with the closest unused old bullet, so reordered and reworded
 * bullets are diffed against their own source instead of whatever used to sit there. */
function pairBullets(before: string[], after: string[]): { old: string | null; next: string; from: number }[] {
  const used = new Set<number>();
  return after.map((next) => {
    let best = -1;
    let bestScore = 0.25; // below this, treat the bullet as new
    before.forEach((old, i) => {
      const score = similarity(old, next);
      if (!used.has(i) && score > bestScore) {
        best = i;
        bestScore = score;
      }
    });
    if (best >= 0) used.add(best);
    return { old: best >= 0 ? before[best] : null, next, from: best };
  });
}

function EntryDiffs({ before, after, section }: { before: Resume; after: Resume; section: "experience" | "projects" }) {
  const entries =
    section === "experience"
      ? after.experience.map((e, i) => ({
          title: `${e.title} — ${e.company}`,
          meta: e.dates,
          bullets: e.bullets,
          old: before.experience[i]?.bullets ?? [],
        }))
      : after.projects.map((p, i) => ({ title: p.name, meta: p.subtitle, bullets: p.bullets, old: before.projects[i]?.bullets ?? [] }));
  if (!entries.length) return <p className="text-sm text-slate-400 italic">Nothing in this section.</p>;

  return (
    <div className="space-y-4">
      {entries.map((entry, i) => {
        const pairs = pairBullets(entry.old, entry.bullets);
        const unchanged = entry.old.join("\n") === entry.bullets.join("\n");
        return (
          <div key={i}>
            <p className="text-sm font-semibold text-slate-800">
              {entry.title} <span className="font-normal text-slate-400">{entry.meta}</span>
            </p>
            {unchanged ? (
              <p className="mt-1 text-sm text-slate-400 italic">No changes.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {pairs.map((p, j) => (
                  <li key={j} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <span className="text-slate-400">•</span>
                    <span className="flex-1">
                      {p.old === null ? (
                        <ins className="rounded bg-emerald-100 px-0.5 text-emerald-900 no-underline">{p.next}</ins>
                      ) : (
                        <InlineDiff before={p.old} after={p.next} />
                      )}
                      {p.from >= 0 && p.from !== j && (
                        <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 uppercase">
                          moved from #{p.from + 1}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function DiffView(props: {
  before: Resume;
  after: Resume;
  beforeLabel: string;
  afterLabel: string;
  sections?: SectionName[];
}) {
  const shown = ALL_SECTIONS.filter((s) => !props.sections || props.sections.includes(s.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-rose-100 ring-1 ring-rose-200" /> Only in {props.beforeLabel}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Only in {props.afterLabel}
        </span>
      </div>
      {shown.map((s) => (
        <section key={s.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-xs font-bold tracking-[0.12em] text-indigo-700 uppercase">{s.label}</h3>
          {s.id === "experience" || s.id === "projects" ? (
            <EntryDiffs before={props.before} after={props.after} section={s.id} />
          ) : sectionText(props.before, s.id) === sectionText(props.after, s.id) ? (
            <p className="text-sm text-slate-400 italic">No changes.</p>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              <InlineDiff before={sectionText(props.before, s.id)} after={sectionText(props.after, s.id)} />
            </p>
          )}
        </section>
      ))}
    </div>
  );
}
