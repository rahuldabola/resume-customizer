import type { Resume, SectionName } from "./types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Plain-text rendering of one section, used by the diff view. */
export function sectionText(resume: Resume, section: SectionName): string {
  switch (section) {
    case "summary":
      return [resume.headline, resume.summary].filter(Boolean).join("\n\n");
    case "skills":
      return resume.skills.map((g) => `${g.category}: ${g.items.join(", ")}`).join("\n");
    case "experience":
      return resume.experience
        .map((e) => [`${e.title} — ${e.company} (${e.dates})`, ...e.bullets.map((b) => `• ${b}`)].join("\n"))
        .join("\n\n");
    case "projects":
      return resume.projects
        .map((p) => [p.name, ...p.bullets.map((b) => `• ${b}`)].join("\n"))
        .join("\n\n");
  }
}
