"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

// The API returns once at the end, so the steps advance on typical timings for each stage.
const STEPS = [
  { label: "Reading your resume", after: 0 },
  { label: "Analyzing the job description", after: 2 },
  { label: "Rewriting sections to match the JD", after: 9 },
  { label: "Scoring and checking for fabrication", after: 20 },
];

export function Progress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
    return () => clearInterval(timer);
  }, []);
  const current = STEPS.findLastIndex((s) => elapsed >= s.after);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" role="status" aria-live="polite">
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3 text-sm">
            {i < current ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : i === current ? (
              <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            ) : (
              <span className="h-5 w-5 rounded-full border-2 border-slate-200" />
            )}
            <span className={i <= current ? "text-slate-800" : "text-slate-400"}>{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-slate-400">Usually takes 15-40 seconds · {Math.floor(elapsed)}s</p>
    </div>
  );
}
