// Mirrors backend/app/schemas.py.

export type SectionName = "summary" | "skills" | "experience" | "projects";
export type Tone = "balanced" | "concise" | "impact";

export const ALL_SECTIONS: { id: SectionName; label: string }[] = [
  { id: "summary", label: "Summary & headline" },
  { id: "skills", label: "Skills" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
];

export const TONES: { id: Tone; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Clear, specific, moderately detailed" },
  { id: "concise", label: "Concise", hint: "Tighter bullets, shorter summary" },
  { id: "impact", label: "Impact-first", hint: "Lead bullets with outcomes and metrics" },
];

export interface SkillGroup {
  category: string;
  items: string[];
}

export interface ExperienceItem {
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
}

export interface ProjectItem {
  name: string;
  subtitle: string;
  bullets: string[];
}

export interface EducationItem {
  degree: string;
  institution: string;
  dates: string;
  details: string;
}

export interface Resume {
  name: string;
  headline: string;
  contact: string[];
  summary: string;
  skills: SkillGroup[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  education: EducationItem[];
  extra_sections: { title: string; items: string[] }[];
}

export interface JDAnalysis {
  role_title: string;
  company: string;
  seniority: string;
  must_have: string[];
  nice_to_have: string[];
  soft_skills: string[];
  key_responsibilities: string[];
}

export type KeywordCategory = "must-have" | "nice-to-have" | "soft-skill" | "responsibility";
export type KeywordStatus = "matched" | "partial" | "missing";

export interface MatchScore {
  score: number;
  keywords: { keyword: string; category: KeywordCategory; status: KeywordStatus }[];
}

export interface AtsScore {
  score: number;
  checks: { label: string; passed: boolean; detail: string; points: number; max_points: number }[];
}

export interface MissingKeyword {
  keyword: string;
  importance: "must-have" | "nice-to-have";
  suggestion: string;
}

export interface CustomizeResponse {
  original: Resume;
  tailored: Resume;
  jd: JDAnalysis;
  match: { before: MatchScore; after: MatchScore };
  ats: { before: AtsScore; after: AtsScore };
  missing_keywords: MissingKeyword[];
  changes: string[];
  guardrail_notes: string[];
  sections: SectionName[];
  tone: Tone;
  model: string;
  resume_meta: { filename: string; size_bytes: number; pages: number; characters: number };
}

/** One generated result, as kept in the version history. */
export interface Version extends CustomizeResponse {
  id: string;
  createdAt: number;
  jobDescription: string;
  coverLetter?: string;
}
