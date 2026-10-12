import { Trash2 } from "lucide-react";

import { TONES, type Version } from "@/lib/types";

export function versionLabel(versions: Version[], v: Version): string {
  return `V${versions.length - versions.indexOf(v)}`;
}

export function VersionBar(props: {
  versions: Version[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { versions } = props;
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {versions.map((v) => {
        const active = v.id === props.activeId;
        return (
          <div
            key={v.id}
            className={`group relative flex shrink-0 items-center rounded-xl border text-left transition ${
              active ? "border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <button onClick={() => props.onSelect(v.id)} className="px-3 py-2 text-left">
              <p className="text-xs font-semibold text-slate-800">
                {versionLabel(versions, v)} · {TONES.find((t) => t.id === v.tone)?.label}
              </p>
              <p className="text-[11px] text-slate-500">
                Match {v.match.after.score}% · ATS {v.ats.after.score}%
              </p>
              <p className="max-w-40 truncate text-[11px] text-slate-400">{v.jd.role_title || "Untitled role"}</p>
            </button>
            <button
              onClick={() => props.onDelete(v.id)}
              aria-label={`Delete ${versionLabel(versions, v)}`}
              className="mr-1 rounded p-1 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-600 focus:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
