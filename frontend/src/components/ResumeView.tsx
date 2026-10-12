import type { Resume } from "@/lib/types";

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 mb-2 border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">
      {children}
    </h3>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 list-disc space-y-1 pl-5 marker:text-slate-400">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export function ResumeView({ resume }: { resume: Resume }) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-8 text-[0.92rem] leading-relaxed text-slate-800 shadow-sm sm:px-10">
      <header className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{resume.name}</h2>
        {resume.headline && <p className="mt-1 font-medium text-slate-600">{resume.headline}</p>}
        {resume.contact.length > 0 && (
          <p className="mt-1 text-xs break-words text-slate-500">{resume.contact.join("  •  ")}</p>
        )}
      </header>

      {resume.summary && (
        <>
          <Heading>Summary</Heading>
          <p>{resume.summary}</p>
        </>
      )}

      {resume.skills.length > 0 && (
        <>
          <Heading>Skills</Heading>
          <dl className="space-y-1">
            {resume.skills.map((g) => (
              <div key={g.category} className="sm:flex sm:gap-2">
                <dt className="shrink-0 font-semibold text-slate-700">{g.category}:</dt>
                <dd>{g.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {resume.experience.length > 0 && (
        <>
          <Heading>Experience</Heading>
          <div className="space-y-4">
            {resume.experience.map((e, i) => (
              <section key={i}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-slate-900">
                    {e.title}
                    {e.company && <span className="font-normal text-slate-600"> · {e.company}</span>}
                  </p>
                  <p className="text-xs text-slate-500">{[e.location, e.dates].filter(Boolean).join(" | ")}</p>
                </div>
                <Bullets items={e.bullets} />
              </section>
            ))}
          </div>
        </>
      )}

      {resume.projects.length > 0 && (
        <>
          <Heading>Projects</Heading>
          <div className="space-y-4">
            {resume.projects.map((p, i) => (
              <section key={i}>
                <p className="font-semibold text-slate-900">
                  {p.name}
                  {p.subtitle && <span className="text-xs font-normal text-slate-500"> — {p.subtitle}</span>}
                </p>
                <Bullets items={p.bullets} />
              </section>
            ))}
          </div>
        </>
      )}

      {resume.education.length > 0 && (
        <>
          <Heading>Education</Heading>
          {resume.education.map((ed, i) => (
            <div key={i} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p>
                <span className="font-semibold text-slate-900">{ed.degree}</span>
                {ed.institution && <span className="text-slate-600"> · {ed.institution}</span>}
                {ed.details && <span className="text-slate-500"> — {ed.details}</span>}
              </p>
              <p className="text-xs text-slate-500">{ed.dates}</p>
            </div>
          ))}
        </>
      )}

      {resume.extra_sections.map((s) =>
        s.items.length ? (
          <div key={s.title}>
            <Heading>{s.title}</Heading>
            <Bullets items={s.items} />
          </div>
        ) : null,
      )}
    </article>
  );
}
