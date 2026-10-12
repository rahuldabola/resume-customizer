import { AlertTriangle, CheckCircle2, CircleDashed, Lightbulb, ShieldCheck, XCircle } from "lucide-react";

import type { CustomizeResponse, KeywordCategory, KeywordStatus } from "@/lib/types";

const CATEGORY_LABEL: Record<KeywordCategory, string> = {
  "must-have": "Must-have",
  "nice-to-have": "Nice-to-have",
  responsibility: "Responsibilities",
  "soft-skill": "Soft skills",
};

const STATUS_STYLE: Record<KeywordStatus, string> = {
  matched: "border-emerald-200 bg-emerald-50 text-emerald-800",
  partial: "border-amber-200 bg-amber-50 text-amber-800",
  missing: "border-slate-200 bg-white text-slate-500",
};

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function InsightsPanel({ result }: { result: CustomizeResponse }) {
  const before = new Map(result.match.before.keywords.map((k) => [k.keyword, k.status]));
  const categories = Object.keys(CATEGORY_LABEL) as KeywordCategory[];

  return (
    <div className="space-y-4">
      <Card title="JD keywords in your tailored resume" icon={<CheckCircle2 className="h-4 w-4 text-indigo-600" />}>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span>
            <span className="font-semibold text-emerald-700">●</span> matched
          </span>
          <span>
            <span className="font-semibold text-amber-600">●</span> partial
          </span>
          <span>
            <span className="font-semibold text-slate-400">●</span> missing
          </span>
          <span>★ newly matched by tailoring</span>
        </div>
        <div className="space-y-3">
          {categories.map((cat) => {
            const items = result.match.after.keywords.filter((k) => k.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat}>
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  {CATEGORY_LABEL[cat]}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((k) => (
                    <span
                      key={k.keyword}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[k.status]}`}
                    >
                      {k.status === "matched" && before.get(k.keyword) !== "matched" && "★ "}
                      {k.keyword}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {result.missing_keywords.length > 0 && (
        <Card title="Missing keywords: add only if true" icon={<Lightbulb className="h-4 w-4 text-amber-500" />}>
          <ul className="space-y-2">
            {result.missing_keywords.map((m) => (
              <li key={m.keyword} className="text-sm">
                <span className="font-semibold text-slate-800">{m.keyword}</span>{" "}
                <span
                  className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    m.importance === "must-have" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {m.importance}
                </span>
                <p className="mt-0.5 text-slate-600">{m.suggestion}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.changes.length > 0 && (
        <Card title="What changed and why" icon={<CircleDashed className="h-4 w-4 text-indigo-600" />}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {result.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="ATS checks (tailored version)" icon={<ShieldCheck className="h-4 w-4 text-indigo-600" />}>
        <ul className="divide-y divide-slate-100">
          {result.ats.after.checks.map((c) => (
            <li key={c.label} className="flex items-start gap-3 py-2 text-sm">
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              )}
              <div className="flex-1">
                <p className="font-medium text-slate-800">{c.label}</p>
                <p className="text-slate-500">{c.detail}</p>
              </div>
              <span className="text-xs whitespace-nowrap text-slate-400">
                {c.points}/{c.max_points}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {result.guardrail_notes.length > 0 && (
        <Card title="Guardrails applied" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            {result.guardrail_notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
