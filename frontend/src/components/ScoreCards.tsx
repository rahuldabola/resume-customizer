import { ArrowRight } from "lucide-react";

function tone(score: number) {
  if (score >= 75) return { bar: "bg-emerald-500", text: "text-emerald-700" };
  if (score >= 50) return { bar: "bg-amber-500", text: "text-amber-700" };
  return { bar: "bg-rose-500", text: "text-rose-700" };
}

function ScoreCard({ title, hint, before, after }: { title: string; hint: string; before: number; after: number }) {
  const delta = after - before;
  const colors = tone(after);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {delta !== 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              delta > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} pts
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="text-lg font-semibold text-slate-400 line-through decoration-slate-300">{before}%</span>
        <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
        <span className={`text-3xl font-bold ${colors.text}`}>{after}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <div className="relative h-full">
          <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300" style={{ width: `${before}%` }} />
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${colors.bar} opacity-90 transition-all duration-700`}
            style={{ width: `${after}%` }}
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function ScoreCards(props: { match: [number, number]; ats: [number, number] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ScoreCard
        title="JD match score"
        hint="Weighted share of the JD's keywords found in the resume (must-haves count most)."
        before={props.match[0]}
        after={props.match[1]}
      />
      <ScoreCard
        title="ATS-friendliness"
        hint="Heuristic: contact info, standard sections, keywords, action verbs, metrics, length."
        before={props.ats[0]}
        after={props.ats[1]}
      />
    </div>
  );
}
