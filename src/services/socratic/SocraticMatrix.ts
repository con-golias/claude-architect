/**
 * The 7×11 Socratic question matrix — pure deterministic data.
 * 7 Aristotelian dimensions × 11 modal operators = 77 question templates.
 * Each template uses {subject} as interpolation placeholder.
 */

import {
  Dimension,
  Operator,
  Tier,
  VerificationMethod,
} from "./SocraticTypes";

/* ── Question templates ──────────────────────────────────── */

type TemplateRow = Record<Operator, string>;
type TemplateMatrix = Record<Dimension, TemplateRow>;

export const QUESTION_TEMPLATES: TemplateMatrix = {
  [Dimension.TI]: {
    [Operator.EINAI]:       "What IS '{subject}'?",
    [Operator.DEN_EINAI]:   "What is '{subject}' NOT?",
    [Operator.PREPEI]:      "What MUST '{subject}' be?",
    [Operator.DEN_PREPEI]:  "What MUST '{subject}' NOT be?",
    [Operator.MPOREI]:      "What CAN '{subject}' be?",
    [Operator.DEN_MPOREI]:  "What CANNOT '{subject}' be?",
    [Operator.ALLAZEI]:     "What CHANGES in '{subject}'?",
    [Operator.EKSARTATAI]:  "What does '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "What does '{subject}' CAUSE?",
    [Operator.MOIAZEI]:     "What RESEMBLES '{subject}'?",
    [Operator.ORIO]:        "Where does '{subject}' END?",
  },
  [Dimension.GIATI]: {
    [Operator.EINAI]:       "Why does '{subject}' EXIST?",
    [Operator.DEN_EINAI]:   "Why doesn't '{subject}' exist ALREADY?",
    [Operator.PREPEI]:      "Why MUST '{subject}' happen?",
    [Operator.DEN_PREPEI]:  "Why MUST '{subject}' NOT happen?",
    [Operator.MPOREI]:      "Why CAN '{subject}' fail?",
    [Operator.DEN_MPOREI]:  "Why CANNOT '{subject}' be done otherwise?",
    [Operator.ALLAZEI]:     "Why does the purpose of '{subject}' CHANGE?",
    [Operator.EKSARTATAI]:  "What does the purpose of '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "Why does '{subject}' CAUSE problems?",
    [Operator.MOIAZEI]:     "Who ELSE solves '{subject}'?",
    [Operator.ORIO]:        "Where does the purpose of '{subject}' END?",
  },
  [Dimension.APO_TI]: {
    [Operator.EINAI]:       "What is '{subject}' COMPOSED OF?",
    [Operator.DEN_EINAI]:   "What is NOT part of '{subject}'?",
    [Operator.PREPEI]:      "What MUST exist before '{subject}'?",
    [Operator.DEN_PREPEI]:  "What MUST NOT be used in '{subject}'?",
    [Operator.MPOREI]:      "What CAN be used for '{subject}'?",
    [Operator.DEN_MPOREI]:  "What CANNOT be used in '{subject}'?",
    [Operator.ALLAZEI]:     "What material CHANGES in '{subject}'?",
    [Operator.EKSARTATAI]:  "What does the material of '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "What downstream effects does '{subject}' CAUSE?",
    [Operator.MOIAZEI]:     "What PATTERN resembles '{subject}'?",
    [Operator.ORIO]:        "What is the material BOUNDARY of '{subject}'?",
  },
  [Dimension.POS]: {
    [Operator.EINAI]:       "How IS '{subject}' done currently?",
    [Operator.DEN_EINAI]:   "How MUST '{subject}' NOT be done?",
    [Operator.PREPEI]:      "How MUST '{subject}' be done?",
    [Operator.DEN_PREPEI]:  "How must '{subject}' NEVER be done?",
    [Operator.MPOREI]:      "How else CAN '{subject}' be done?",
    [Operator.DEN_MPOREI]:  "How CANNOT '{subject}' be done?",
    [Operator.ALLAZEI]:     "How does the method of '{subject}' CHANGE?",
    [Operator.EKSARTATAI]:  "What does the method of '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "How does '{subject}' CAUSE side effects?",
    [Operator.MOIAZEI]:     "How do OTHERS do '{subject}'?",
    [Operator.ORIO]:        "Where does the method of '{subject}' STOP?",
  },
  [Dimension.POTE]: {
    [Operator.EINAI]:       "When IS '{subject}' done?",
    [Operator.DEN_EINAI]:   "When MUST '{subject}' NOT be done?",
    [Operator.PREPEI]:      "What MUST happen BEFORE '{subject}'?",
    [Operator.DEN_PREPEI]:  "What MUST NOT happen before '{subject}'?",
    [Operator.MPOREI]:      "What CAN run in PARALLEL with '{subject}'?",
    [Operator.DEN_MPOREI]:  "What CANNOT run in parallel with '{subject}'?",
    [Operator.ALLAZEI]:     "When does the order of '{subject}' CHANGE?",
    [Operator.EKSARTATAI]:  "What does the order of '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "When does '{subject}' CAUSE problems?",
    [Operator.MOIAZEI]:     "When was this done ELSEWHERE for '{subject}'?",
    [Operator.ORIO]:        "How much TIME is available for '{subject}'?",
  },
  [Dimension.POIOS]: {
    [Operator.EINAI]:       "Who IS involved in '{subject}'?",
    [Operator.DEN_EINAI]:   "Who is NOT involved in '{subject}'?",
    [Operator.PREPEI]:      "Who MUST approve '{subject}'?",
    [Operator.DEN_PREPEI]:  "Who MUST NOT touch '{subject}'?",
    [Operator.MPOREI]:      "Who CAN help with '{subject}'?",
    [Operator.DEN_MPOREI]:  "Who CANNOT do '{subject}'?",
    [Operator.ALLAZEI]:     "Who is AFFECTED by '{subject}'?",
    [Operator.EKSARTATAI]:  "Who DEPENDS on whom in '{subject}'?",
    [Operator.PROKALEI]:    "Who does '{subject}' IMPACT?",
    [Operator.MOIAZEI]:     "Who has done '{subject}' WELL before?",
    [Operator.ORIO]:        "Who DECIDES the boundaries of '{subject}'?",
  },
  [Dimension.POU]: {
    [Operator.EINAI]:       "Where IS '{subject}' in the codebase?",
    [Operator.DEN_EINAI]:   "Where MUST '{subject}' NOT be?",
    [Operator.PREPEI]:      "Where MUST '{subject}' be placed?",
    [Operator.DEN_PREPEI]:  "Where must '{subject}' NEVER go?",
    [Operator.MPOREI]:      "Where ELSE could '{subject}' go?",
    [Operator.DEN_MPOREI]:  "Where CANNOT '{subject}' be?",
    [Operator.ALLAZEI]:     "Where does '{subject}' CHANGE at runtime?",
    [Operator.EKSARTATAI]:  "What does the location of '{subject}' DEPEND ON?",
    [Operator.PROKALEI]:    "Where does '{subject}' CAUSE changes?",
    [Operator.MOIAZEI]:     "Where does something LIKE '{subject}' already EXIST?",
    [Operator.ORIO]:        "Where does '{subject}' END?",
  },
};

/* ── Human-readable labels ───────────────────────────────── */

export const DIMENSION_LABELS: Record<Dimension, string> = {
  [Dimension.TI]:    "WHAT (Essence)",
  [Dimension.GIATI]: "WHY (Purpose)",
  [Dimension.APO_TI]:"FROM WHAT (Material)",
  [Dimension.POS]:   "HOW (Method)",
  [Dimension.POTE]:  "WHEN (Time)",
  [Dimension.POIOS]: "WHO (Subject)",
  [Dimension.POU]:   "WHERE (Location)",
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  [Operator.EINAI]:       "IS",
  [Operator.DEN_EINAI]:   "IS NOT",
  [Operator.PREPEI]:      "MUST",
  [Operator.DEN_PREPEI]:  "MUST NOT",
  [Operator.MPOREI]:      "CAN",
  [Operator.DEN_MPOREI]:  "CANNOT",
  [Operator.ALLAZEI]:     "CHANGES",
  [Operator.EKSARTATAI]:  "DEPENDS ON",
  [Operator.PROKALEI]:    "CAUSES",
  [Operator.MOIAZEI]:     "RESEMBLES",
  [Operator.ORIO]:        "BOUNDARY",
};

/* ── Verification method per dimension ───────────────────── */

export const VERIFICATION_MAP: Record<Dimension, {
  method: VerificationMethod;
  description: string;
}> = {
  [Dimension.TI]:    { method: VerificationMethod.WEB_SEARCH,          description: "Search for definition, spec, standard" },
  [Dimension.GIATI]: { method: VerificationMethod.ASK_USER,            description: "Ask the user about the purpose" },
  [Dimension.APO_TI]:{ method: VerificationMethod.READ_CODEBASE,       description: "Read package.json, grep imports, check dependencies" },
  [Dimension.POS]:   { method: VerificationMethod.WEB_SEARCH_AND_DOCS, description: "Search best practice, official docs" },
  [Dimension.POTE]:  { method: VerificationMethod.READ_CODEBASE,       description: "Check dependency graph, imports, CI config" },
  [Dimension.POIOS]: { method: VerificationMethod.ASK_USER,            description: "Ask about team structure, responsibilities" },
  [Dimension.POU]:   { method: VerificationMethod.READ_CODEBASE,       description: "Find files, list directories, grep for patterns" },
};

/* ── Tier → question strategy ────────────────────────────── */

const ALL_DIMENSIONS = Object.values(Dimension);
const ALL_OPERATORS = Object.values(Operator);

export const TIER_STRATEGY: Record<Tier, {
  dimensions: Dimension[];
  operators: Operator[];
}> = {
  [Tier.TRIVIAL]: {
    dimensions: [],
    operators: [],
  },
  [Tier.STANDARD]: {
    dimensions: ALL_DIMENSIONS,
    operators: [Operator.EINAI],
  },
  [Tier.SIGNIFICANT]: {
    dimensions: ALL_DIMENSIONS,
    operators: ALL_OPERATORS,
  },
};

/* ── Recursion strategy per level ────────────────────────── */

export const RECURSION_STRATEGY: Record<number, {
  dimensions: Dimension[];
  operators: Operator[];
  maxQuestions: number;
}> = {
  2: {
    dimensions: ALL_DIMENSIONS,
    operators: [Operator.EINAI],
    maxQuestions: 35,
  },
  3: {
    dimensions: [Dimension.TI, Dimension.APO_TI, Dimension.POU],
    operators: [Operator.EINAI],
    maxQuestions: 15,
  },
};
