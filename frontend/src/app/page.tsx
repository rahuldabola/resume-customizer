import { FileText } from "lucide-react";

import { ClientWorkspace } from "@/components/ClientWorkspace";

export default function Home() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold text-slate-900">Resume Customizer</h1>
              <p className="text-xs text-slate-500">Tailor your resume to any job description with AI</p>
            </div>
          </div>
          <a
            href="https://github.com/rahuldabola/resume-customizer"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            GitHub
          </a>
        </div>
      </header>
      <ClientWorkspace />
    </>
  );
}
