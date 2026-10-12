"use client";

import { AlertCircle, Download, FileSearch, GitCompare, Loader2, Sparkles, Target, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, customizeResume, downloadResume } from "@/lib/api";
import { ALL_SECTIONS, type SectionName, type Tone, type Version } from "@/lib/types";

import { CoverLetter } from "./CoverLetter";
import { DiffView } from "./DiffView";
import { InputPanel } from "./InputPanel";
import { InsightsPanel } from "./InsightsPanel";
import { Progress } from "./Progress";
import { ResumeView } from "./ResumeView";
import { ScoreCards } from "./ScoreCards";
import { VersionBar, versionLabel } from "./Versions";

const STORAGE_KEY = "resume-customizer.versions";
const MAX_VERSIONS = 8;

type Tab = "tailored" | "changes" | "insights" | "cover" | "compare";

function loadVersions(): Version[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function Workspace() {
  // Rendered client-only (see ClientWorkspace), so localStorage is safe to read here.
  const [versions, setVersions] = useState<Version[]>(loadVersions);
  const [jobDescription, setJobDescription] = useState(() => versions[0]?.jobDescription ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [sections, setSections] = useState<SectionName[]>(ALL_SECTIONS.map((s) => s.id));
  const [tone, setTone] = useState<Tone>("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(() => versions[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("tailored");
  const [compareIds, setCompareIds] = useState<[string, string]>(["", ""]);
  const [downloading, setDownloading] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    } catch {
      // storage full or disabled: history just won't persist
    }
  }, [versions]);

  const active = versions.find((v) => v.id === activeId) ?? versions[0];

  async function submit() {
    if (!file) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await customizeResume({ jobDescription, file, sections, tone, signal: controller.signal });
      const version: Version = { ...result, id: crypto.randomUUID(), createdAt: Date.now(), jobDescription };
      setVersions((prev) => [version, ...prev].slice(0, MAX_VERSIONS));
      setActiveId(version.id);
      setTab("tailored");
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (abort.current === controller) setLoading(false);
    }
  }

  async function loadSample() {
    try {
      const [jd, pdf] = await Promise.all([
        fetch("/samples/sample_job_description.txt").then((r) => r.text()),
        fetch("/samples/sample_resume.pdf").then((r) => r.blob()),
      ]);
      setJobDescription(jd);
      setFile(new File([pdf], "sample_resume.pdf", { type: "application/pdf" }));
      setError(null);
    } catch {
      setError("Could not load the sample files.");
    }
  }

  async function download(format: "pdf" | "docx" | "txt") {
    if (!active) return;
    setDownloading(format);
    try {
      await downloadResume(active.tailored, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setDownloading(null);
    }
  }

  function deleteVersion(id: string) {
    setVersions((prev) => {
      const next = prev.filter((v) => v.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? "");
      return next;
    });
  }

  function saveCoverLetter(id: string, text: string) {
    setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, coverLetter: text } : v)));
  }

  const tabs = useMemo(
    () =>
      [
        { id: "tailored", label: "Tailored resume" },
        { id: "changes", label: "Changes" },
        { id: "insights", label: "Keywords & ATS" },
        { id: "cover", label: "Cover letter" },
        ...(versions.length > 1 ? [{ id: "compare", label: "Compare versions" }] : []),
      ] as { id: Tab; label: string }[],
    [versions.length],
  );

  const [compareA, compareB] = [
    versions.find((v) => v.id === compareIds[0]) ?? versions[1],
    versions.find((v) => v.id === compareIds[1]) ?? versions[0],
  ];

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:py-8">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
          <InputPanel
            jobDescription={jobDescription}
            onJobDescription={setJobDescription}
            file={file}
            onFile={setFile}
            sections={sections}
            onSections={setSections}
            tone={tone}
            onTone={setTone}
            loading={loading}
            hasResult={versions.length > 0}
            onSubmit={submit}
            onLoadSample={loadSample}
          />
          {loading && (
            <button
              onClick={() => {
                abort.current?.abort();
                setLoading(false);
              }}
              className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          )}
        </div>
        <p className="mt-3 px-1 text-xs leading-relaxed text-slate-400">
          Your file is processed in memory and never stored on the server. Generated versions are kept only in this
          browser.
        </p>
      </aside>

      <main ref={resultsRef} className="min-w-0 scroll-mt-6 space-y-5">
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button onClick={() => setError(null)} aria-label="Dismiss" className="text-rose-500 hover:text-rose-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && <Progress />}

        {!active && !loading && <EmptyState />}

        {active && (
          <>
            {versions.length > 1 && (
              <VersionBar versions={versions} activeId={active.id} onSelect={setActiveId} onDelete={deleteVersion} />
            )}

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium tracking-wide text-indigo-600 uppercase">
                  {versionLabel(versions, active)} · tailored for
                </p>
                <h2 className="text-xl font-bold text-slate-900">
                  {active.jd.role_title || "This role"}
                  {active.jd.company && <span className="font-normal text-slate-500"> at {active.jd.company}</span>}
                </h2>
                <p className="text-xs text-slate-400">
                  From {active.resume_meta.filename} · model {active.model}
                </p>
              </div>
              <div className="flex gap-2">
                {(["pdf", "docx", "txt"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => download(fmt)}
                    disabled={downloading !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                  >
                    {downloading === fmt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <ScoreCards
              match={[active.match.before.score, active.match.after.score]}
              ats={[active.ats.before.score, active.ats.after.score]}
            />

            <div role="tablist" className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-slate-200">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                    tab === t.id
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div role="tabpanel">
              {tab === "tailored" && <ResumeView resume={active.tailored} />}
              {tab === "changes" && (
                <DiffView
                  before={active.original}
                  after={active.tailored}
                  beforeLabel="original"
                  afterLabel="tailored"
                  sections={active.sections}
                />
              )}
              {tab === "insights" && <InsightsPanel result={active} />}
              {tab === "cover" && (
                <CoverLetter key={active.id} version={active} onSaved={(text) => saveCoverLetter(active.id, text)} />
              )}
              {tab === "compare" && compareA && compareB && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <GitCompare className="h-4 w-4 text-indigo-600" />
                    {[0, 1].map((slot) => (
                      <select
                        key={slot}
                        value={(slot === 0 ? compareA : compareB).id}
                        onChange={(e) =>
                          setCompareIds((prev) =>
                            slot === 0 ? [e.target.value, prev[1] || compareB.id] : [prev[0] || compareA.id, e.target.value],
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
                      >
                        {versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {versionLabel(versions, v)} · {v.tone} · match {v.match.after.score}% · ATS{" "}
                            {v.ats.after.score}%
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                  <DiffView
                    before={compareA.tailored}
                    after={compareB.tailored}
                    beforeLabel={versionLabel(versions, compareA)}
                    afterLabel={versionLabel(versions, compareB)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  const items = [
    {
      icon: <Target className="h-5 w-5 text-indigo-600" />,
      title: "Match score",
      text: "See how well your resume covers the JD's must-have keywords, before and after tailoring.",
    },
    {
      icon: <Sparkles className="h-5 w-5 text-indigo-600" />,
      title: "Truthful rewrite",
      text: "Summary, skills and bullets are rephrased in the JD's language. Nothing is invented; guardrails enforce it.",
    },
    {
      icon: <FileSearch className="h-5 w-5 text-indigo-600" />,
      title: "Diff, ATS check & cover letter",
      text: "Review every change, fix ATS issues, generate a cover letter, then download PDF, DOCX or TXT.",
    },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 p-8">
      <h2 className="text-lg font-semibold text-slate-900">Tailor your resume to any job in under a minute</h2>
      <p className="mt-1 text-sm text-slate-500">
        Paste a job description, upload your resume, and choose what to customize. No account needed. Want to see it
        first? Click <span className="font-medium text-indigo-600">Try with a sample</span>.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-4">
            {item.icon}
            <p className="mt-2 text-sm font-semibold text-slate-800">{item.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
