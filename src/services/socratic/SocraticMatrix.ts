/**
 * The 7×11 Socratic question matrix — pure deterministic data.
 * 7 Aristotelian dimensions × 11 modal operators = 77 question templates.
 * Each template uses {subject} as interpolation placeholder.
 *
 * @module SocraticMatrix
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
    [Operator.EINAI]:       "Τι ΕΙΝΑΙ '{subject}';",
    [Operator.DEN_EINAI]:   "Τι ΔΕΝ είναι '{subject}';",
    [Operator.PREPEI]:      "Τι ΠΡΕΠΕΙ να είναι '{subject}';",
    [Operator.DEN_PREPEI]:  "Τι ΔΕΝ πρέπει να είναι '{subject}';",
    [Operator.MPOREI]:      "Τι ΜΠΟΡΕΙ να είναι '{subject}';",
    [Operator.DEN_MPOREI]:  "Τι ΔΕΝ μπορεί να είναι '{subject}';",
    [Operator.ALLAZEI]:     "Τι ΑΛΛΑΖΕΙ στο '{subject}';",
    [Operator.EKSARTATAI]:  "Από τι ΕΞΑΡΤΑΤΑΙ το '{subject}';",
    [Operator.PROKALEI]:    "Τι ΠΡΟΚΑΛΕΙ το '{subject}';",
    [Operator.MOIAZEI]:     "Τι ΜΟΙΑΖΕΙ με '{subject}';",
    [Operator.ORIO]:        "Πού ΤΕΛΕΙΩΝΕΙ το '{subject}';",
  },
  [Dimension.GIATI]: {
    [Operator.EINAI]:       "Γιατί ΥΠΑΡΧΕΙ '{subject}';",
    [Operator.DEN_EINAI]:   "Γιατί ΔΕΝ υπάρχει ήδη '{subject}';",
    [Operator.PREPEI]:      "Γιατί ΠΡΕΠΕΙ '{subject}';",
    [Operator.DEN_PREPEI]:  "Γιατί ΔΕΝ πρέπει '{subject}';",
    [Operator.MPOREI]:      "Γιατί ΜΠΟΡΕΙ να αποτύχει '{subject}';",
    [Operator.DEN_MPOREI]:  "Γιατί ΔΕΝ μπορεί αλλιώς '{subject}';",
    [Operator.ALLAZEI]:     "Γιατί ΑΛΛΑΖΕΙ ο σκοπός '{subject}';",
    [Operator.EKSARTATAI]:  "Ο σκοπός '{subject}' ΕΞΑΡΤΑΤΑΙ από τι;",
    [Operator.PROKALEI]:    "Γιατί ΠΡΟΚΑΛΕΙ πρόβλημα '{subject}';",
    [Operator.MOIAZEI]:     "Ποιος ΑΛΛΟΣ λύνει '{subject}';",
    [Operator.ORIO]:        "Πού ΤΕΛΕΙΩΝΕΙ ο σκοπός '{subject}';",
  },
  [Dimension.APO_TI]: {
    [Operator.EINAI]:       "Από τι ΑΠΟΤΕΛΕΙΤΑΙ '{subject}';",
    [Operator.DEN_EINAI]:   "Τι ΔΕΝ αποτελεί μέρος '{subject}';",
    [Operator.PREPEI]:      "Τι ΠΡΕΠΕΙ να υπάρχει πριν '{subject}';",
    [Operator.DEN_PREPEI]:  "Τι ΔΕΝ πρέπει να χρησιμοποιηθεί στο '{subject}';",
    [Operator.MPOREI]:      "Τι ΜΠΟΡΕΙ να χρησιμοποιηθεί για '{subject}';",
    [Operator.DEN_MPOREI]:  "Τι ΔΕΝ μπορεί να χρησιμοποιηθεί στο '{subject}';",
    [Operator.ALLAZEI]:     "Τι υλικό ΑΛΛΑΖΕΙ στο '{subject}';",
    [Operator.EKSARTATAI]:  "Το υλικό '{subject}' ΕΞΑΡΤΑΤΑΙ από τι;",
    [Operator.PROKALEI]:    "Τι downstream ΠΡΟΚΑΛΕΙ '{subject}';",
    [Operator.MOIAZEI]:     "Ποιο PATTERN μοιάζει με '{subject}';",
    [Operator.ORIO]:        "Ποιο είναι το ΟΡΙΟ υλικού '{subject}';",
  },
  [Dimension.POS]: {
    [Operator.EINAI]:       "Πώς ΓΙΝΕΤΑΙ τώρα '{subject}';",
    [Operator.DEN_EINAI]:   "Πώς ΔΕΝ πρέπει να γίνει '{subject}';",
    [Operator.PREPEI]:      "Πώς ΠΡΕΠΕΙ να γίνει '{subject}';",
    [Operator.DEN_PREPEI]:  "Πώς ΔΕΝ πρέπει ποτέ '{subject}';",
    [Operator.MPOREI]:      "Πώς αλλιώς ΜΠΟΡΕΙ '{subject}';",
    [Operator.DEN_MPOREI]:  "Πώς ΔΕΝ μπορεί να γίνει '{subject}';",
    [Operator.ALLAZEI]:     "Πώς ΑΛΛΑΖΕΙ η μέθοδος '{subject}';",
    [Operator.EKSARTATAI]:  "Η μέθοδος '{subject}' ΕΞΑΡΤΑΤΑΙ από τι;",
    [Operator.PROKALEI]:    "Πώς ΠΡΟΚΑΛΕΙ side effects '{subject}';",
    [Operator.MOIAZEI]:     "Πώς κάνουν ΑΛΛΟΙ '{subject}';",
    [Operator.ORIO]:        "Πού ΣΤΑΜΑΤΑ η μέθοδος '{subject}';",
  },
  [Dimension.POTE]: {
    [Operator.EINAI]:       "Πότε ΓΙΝΕΤΑΙ '{subject}';",
    [Operator.DEN_EINAI]:   "Πότε ΔΕΝ πρέπει να γίνει '{subject}';",
    [Operator.PREPEI]:      "Τι ΠΡΕΠΕΙ πρώτα πριν '{subject}';",
    [Operator.DEN_PREPEI]:  "Τι ΔΕΝ πρέπει πρώτα στο '{subject}';",
    [Operator.MPOREI]:      "Τι ΜΠΟΡΕΙ παράλληλα με '{subject}';",
    [Operator.DEN_MPOREI]:  "Τι ΔΕΝ μπορεί παράλληλα με '{subject}';",
    [Operator.ALLAZEI]:     "Πότε ΑΛΛΑΖΕΙ η σειρά '{subject}';",
    [Operator.EKSARTATAI]:  "Η σειρά '{subject}' ΕΞΑΡΤΑΤΑΙ από τι;",
    [Operator.PROKALEI]:    "Πότε ΠΡΟΚΑΛΕΙ πρόβλημα '{subject}';",
    [Operator.MOIAZEI]:     "Πότε ΕΓΙΝΕ αυτό αλλού '{subject}';",
    [Operator.ORIO]:        "Πόσος ΧΡΟΝΟΣ υπάρχει για '{subject}';",
  },
  [Dimension.POIOS]: {
    [Operator.EINAI]:       "Ποιος ΕΜΠΛΕΚΕΤΑΙ στο '{subject}';",
    [Operator.DEN_EINAI]:   "Ποιος ΔΕΝ εμπλέκεται στο '{subject}';",
    [Operator.PREPEI]:      "Ποιος ΠΡΕΠΕΙ να εγκρίνει '{subject}';",
    [Operator.DEN_PREPEI]:  "Ποιος ΔΕΝ πρέπει να πειράξει '{subject}';",
    [Operator.MPOREI]:      "Ποιος ΜΠΟΡΕΙ να βοηθήσει στο '{subject}';",
    [Operator.DEN_MPOREI]:  "Ποιος ΔΕΝ μπορεί '{subject}';",
    [Operator.ALLAZEI]:     "Ποιος ΕΠΗΡΕΑΖΕΤΑΙ από '{subject}';",
    [Operator.EKSARTATAI]:  "Ποιος ΕΞΑΡΤΑΤΑΙ από ποιον στο '{subject}';",
    [Operator.PROKALEI]:    "Σε ποιον ΠΡΟΚΑΛΕΙ impact '{subject}';",
    [Operator.MOIAZEI]:     "Ποιος ΕΚΑΝΕ αυτό καλά '{subject}';",
    [Operator.ORIO]:        "Ποιος ΑΠΟΦΑΣΙΖΕΙ τα όρια '{subject}';",
  },
  [Dimension.POU]: {
    [Operator.EINAI]:       "Πού ΕΙΝΑΙ '{subject}' στον κώδικα;",
    [Operator.DEN_EINAI]:   "Πού ΔΕΝ πρέπει να είναι '{subject}';",
    [Operator.PREPEI]:      "Πού ΠΡΕΠΕΙ να μπει '{subject}';",
    [Operator.DEN_PREPEI]:  "Πού ΔΕΝ πρέπει ποτέ '{subject}';",
    [Operator.MPOREI]:      "Πού αλλού ΜΠΟΡΕΙ '{subject}';",
    [Operator.DEN_MPOREI]:  "Πού ΔΕΝ μπορεί '{subject}';",
    [Operator.ALLAZEI]:     "Πού ΑΛΛΑΖΕΙ στο runtime '{subject}';",
    [Operator.EKSARTATAI]:  "Η τοποθεσία '{subject}' ΕΞΑΡΤΑΤΑΙ από τι;",
    [Operator.PROKALEI]:    "Πού ΠΡΟΚΑΛΕΙ αλλαγή '{subject}';",
    [Operator.MOIAZEI]:     "Πού υπάρχει ΗΔΗ κάτι σαν '{subject}';",
    [Operator.ORIO]:        "Πού ΤΕΛΕΙΩΝΕΙ '{subject}';",
  },
};

/* ── Human-readable labels ───────────────────────────────── */

export const DIMENSION_LABELS: Record<Dimension, string> = {
  [Dimension.TI]:    "ΤΙ (Ουσία)",
  [Dimension.GIATI]: "ΓΙΑΤΙ (Σκοπός)",
  [Dimension.APO_TI]:"ΑΠΟ ΤΙ (Ύλη)",
  [Dimension.POS]:   "ΠΩΣ (Μέθοδος)",
  [Dimension.POTE]:  "ΠΟΤΕ (Χρόνος)",
  [Dimension.POIOS]: "ΠΟΙΟΣ (Υποκείμενο)",
  [Dimension.POU]:   "ΠΟΥ (Τόπος)",
};

export const OPERATOR_LABELS: Record<Operator, string> = {
  [Operator.EINAI]:       "ΕΙΝΑΙ",
  [Operator.DEN_EINAI]:   "ΔΕΝ ΕΙΝΑΙ",
  [Operator.PREPEI]:      "ΠΡΕΠΕΙ",
  [Operator.DEN_PREPEI]:  "ΔΕΝ ΠΡΕΠΕΙ",
  [Operator.MPOREI]:      "ΜΠΟΡΕΙ",
  [Operator.DEN_MPOREI]:  "ΔΕΝ ΜΠΟΡΕΙ",
  [Operator.ALLAZEI]:     "ΑΛΛΑΖΕΙ",
  [Operator.EKSARTATAI]:  "ΕΞΑΡΤΑΤΑΙ",
  [Operator.PROKALEI]:    "ΠΡΟΚΑΛΕΙ",
  [Operator.MOIAZEI]:     "ΜΟΙΑΖΕΙ",
  [Operator.ORIO]:        "ΟΡΙΟ",
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
