"use client";

import { Check, Copy, Download, Loader2, PenLine, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { saveBlob, streamCoverLetter } from "@/lib/api";
import type { Version } from "@/lib/types";

export function CoverLetter({ version, onSaved }: { version: Version; onSaved: (text: string) => void }) {
  const [text, setText] = useState(version.coverLetter ?? "");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // The parent remounts this component per version (key), so only cancel on unmount.
  useEffect(() => () => abort.current?.abort(), []);

  async function generate() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStreaming(true);
    setError(null);
    setText("");
    try {
      const full = await streamCoverLetter(
        { resume: version.tailored, jd: version.jd, job_description: version.jobDescription },
        setText,
        controller.signal,
      );
      onSaved(full);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      if (abort.current === controller) setStreaming(false);
    }
  }

  const company = version.jd.company || "the company";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-slate-800">Cover letter</p>
          <p className="text-xs text-slate-500">
            Written from your tailored resume for {version.jd.role_title || "this role"} at {company}. Streams live.
          </p>
        </div>
        <div className="flex gap-2">
          {streaming ? (
            <button
              onClick={() => abort.current?.abort()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button
              onClick={generate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <PenLine className="h-4 w-4" /> {text ? "Regenerate" : "Generate cover letter"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {(text || streaming) && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="min-h-24 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-slate-800">
            {text}
            {streaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-indigo-500 align-middle" />}
            {streaming && !text && (
              <span className="inline-flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Writing…
              </span>
            )}
          </p>
          {!streaming && text && (
            <div className="mt-5 flex gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                onClick={() =>
                  saveBlob(
                    new Blob([text], { type: "text/plain;charset=utf-8" }),
                    `${version.tailored.name.replace(/\W+/g, "_")}_cover_letter.txt`,
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Download .txt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
