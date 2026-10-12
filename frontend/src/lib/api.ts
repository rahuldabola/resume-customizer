import type { CustomizeResponse, JDAnalysis, Resume, SectionName, Tone } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {}

async function errorFrom(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    if (typeof body.detail === "string") return new ApiError(body.detail);
    if (Array.isArray(body.detail)) return new ApiError(body.detail[0]?.msg ?? "Invalid request.");
  } catch {
    // not JSON (e.g. a proxy error page)
  }
  if (res.status === 413) return new ApiError("The file is too large.");
  return new ApiError(`The server returned an error (${res.status}). Please try again.`);
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}

export async function customizeResume(params: {
  jobDescription: string;
  file: File;
  sections: SectionName[];
  tone: Tone;
  signal?: AbortSignal;
}): Promise<CustomizeResponse> {
  const form = new FormData();
  form.append("job_description", params.jobDescription);
  form.append("file", params.file);
  form.append("sections", params.sections.join(","));
  form.append("tone", params.tone);
  const res = await request("/api/customize", { method: "POST", body: form, signal: params.signal });
  return res.json();
}

const STREAM_ERROR = "[[ERROR]]";

/** Streams the cover letter, calling onChunk with the full text so far. */
export async function streamCoverLetter(
  body: { resume: Resume; jd: JDAnalysis; job_description: string },
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await request("/api/cover-letter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.body) throw new ApiError("Streaming is not supported by this browser.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    const marker = text.indexOf(STREAM_ERROR);
    if (marker !== -1) throw new ApiError(text.slice(marker + STREAM_ERROR.length).trim());
    onChunk(text);
  }
  return text.trim();
}

export async function downloadResume(resume: Resume, format: "pdf" | "docx" | "txt"): Promise<void> {
  const res = await request("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume, format }),
  });
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `resume_tailored.${format}`;
  saveBlob(await res.blob(), filename);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
