"use client";

import { FileText, Loader2, Sparkles, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { formatBytes } from "@/lib/resumeText";
import { ALL_SECTIONS, TONES, type SectionName, type Tone } from "@/lib/types";

export const JD_MIN = 100;
export const JD_MAX = 15000;
export const MAX_FILE_MB = 5;
const ACCEPTED = [".pdf", ".docx"];

export function validateFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc")) return "Old .doc files are not supported. Save the resume as .docx or PDF.";
  if (!ACCEPTED.some((ext) => name.endsWith(ext))) return "Unsupported file type. Upload a PDF or DOCX resume.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `The file is larger than ${MAX_FILE_MB} MB.`;
  return null;
}

interface Props {
  jobDescription: string;
  onJobDescription: (value: string) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  sections: SectionName[];
  onSections: (value: SectionName[]) => void;
  tone: Tone;
  onTone: (value: Tone) => void;
  loading: boolean;
  hasResult: boolean;
  onSubmit: () => void;
  onLoadSample: () => void;
}

export function InputPanel(props: Props) {
  const { jobDescription, file, sections, tone, loading } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const jdLength = jobDescription.trim().length;
  const jdError =
    jdLength === 0
      ? "Paste the job description."
      : jdLength < JD_MIN
        ? `Too short: ${JD_MIN - jdLength} more characters needed.`
        : jdLength > JD_MAX
          ? `Too long: max ${JD_MAX.toLocaleString()} characters.`
          : null;
  const canSubmit = !jdError && !!file && sections.length > 0 && !loading;

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    const error = validateFile(candidate);
    setFileError(error);
    props.onFile(error ? null : candidate);
  }

  function toggleSection(id: SectionName) {
    props.onSections(sections.includes(id) ? sections.filter((s) => s !== id) : [...sections, id]);
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (canSubmit) props.onSubmit();
      }}
    >
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label htmlFor="jd" className="text-sm font-semibold text-slate-800">
            1. Job description
          </label>
          <button type="button" onClick={props.onLoadSample} className="text-xs font-medium text-indigo-600 hover:underline">
            Try with a sample
          </button>
        </div>
        <textarea
          id="jd"
          value={jobDescription}
          onChange={(e) => props.onJobDescription(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="Paste the full job description here: responsibilities, requirements, nice-to-haves…"
          rows={10}
          className={`w-full resize-y rounded-xl border bg-white p-3 text-sm leading-relaxed text-slate-800 shadow-sm outline-none transition focus:ring-2 ${
            touched && jdError ? "border-rose-300 focus:ring-rose-200" : "border-slate-200 focus:ring-indigo-200"
          }`}
        />
        <div className="mt-1 flex justify-between text-xs">
          <span className={touched && jdError ? "text-rose-600" : "text-slate-400"}>
            {touched && jdError ? jdError : `Minimum ${JD_MIN} characters`}
          </span>
          <span className={jdLength > JD_MAX ? "text-rose-600" : "text-slate-400"}>
            {jdLength.toLocaleString()} / {JD_MAX.toLocaleString()}
          </span>
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-800">2. Your resume</p>
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
            <FileText className="h-8 w-8 shrink-0 text-indigo-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => props.onFile(null)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files[0]);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-300"
            }`}
          >
            <Upload className="h-6 w-6 text-indigo-500" aria-hidden />
            <span className="text-sm font-medium text-slate-700">Drop your resume or click to browse</span>
            <span className="text-xs text-slate-400">PDF or DOCX, up to {MAX_FILE_MB} MB</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        {fileError && <p className="mt-1 text-xs text-rose-600">{fileError}</p>}
        {touched && !file && !fileError && <p className="mt-1 text-xs text-rose-600">Upload your resume.</p>}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">3. Sections to customize</legend>
        <div className="grid grid-cols-2 gap-2">
          {ALL_SECTIONS.map((s) => (
            <label
              key={s.id}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                sections.includes(s.id)
                  ? "border-indigo-300 bg-indigo-50 text-indigo-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <input
                type="checkbox"
                checked={sections.includes(s.id)}
                onChange={() => toggleSection(s.id)}
                className="accent-indigo-600"
              />
              {s.label}
            </label>
          ))}
        </div>
        {sections.length === 0 && <p className="mt-1 text-xs text-rose-600">Choose at least one section.</p>}
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">4. Writing style</legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              title={t.hint}
              onClick={() => props.onTone(t.id)}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                tone === t.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">{TONES.find((t) => t.id === tone)?.hint}</p>
      </fieldset>

      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {loading ? "Tailoring your resume…" : props.hasResult ? "Generate another version" : "Tailor my resume"}
      </button>
    </form>
  );
}
