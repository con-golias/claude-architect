/**
 * PostToolUse hook handler.
 * Runs lightweight validation after file writes.
 * Includes Socratic binding enforcement — checks code against verified answers.
 *
 * @module post-change
 */

import { readFileSync } from "fs";
import { getDatabase } from "../../services/sqlite/Database";
import { findProjectByPath } from "../../services/sqlite/Projects";
import { createViolation } from "../../services/sqlite/Violations";
import { trackViolation } from "../../services/sqlite/Improvements";
import { getActiveSession, getAnswersBySession } from "../../services/sqlite/Socratic";
import { quickValidate } from "../../services/validator/ValidatorEngine";
import { logger } from "../../utils/logger";
import { getProjectPath } from "../../utils/paths";
import type { Violation } from "../../types/validation";

/**
 * Handle post-change validation.
 * Runs quick checks + Socratic binding enforcement on changed files.
 */
export default async function handlePostChange(): Promise<void> {
  const projectPath = getProjectPath();
  const db = getDatabase();
  const project = findProjectByPath(db, projectPath);

  if (!project) {
    process.stdout.write("Success");
    return;
  }

  const changedFile = process.env.TOOL_INPUT_FILE_PATH || "";
  if (!changedFile) {
    process.stdout.write("Success");
    return;
  }

  const violations = quickValidate(projectPath, changedFile);

  // Socratic binding enforcement — check code against KSERO verified answers
  const bindingViolations = checkSocraticBindings(changedFile);
  violations.push(...bindingViolations);

  if (violations.length === 0) {
    process.stdout.write("Success");
    return;
  }

  const sessionId = process.env.CLAUDE_SESSION_ID;
  for (const v of violations) {
    createViolation(db, {
      projectId: project.id, sessionId, ruleId: v.ruleId, ruleName: v.ruleName,
      severity: v.severity, category: v.category, filePath: v.filePath,
      lineNumber: v.lineNumber, description: v.description, suggestion: v.suggestion,
    });
    trackViolation(db, v.ruleId, project.id);
  }

  const parts: string[] = [];
  parts.push(`# [claude-architect] violations detected`);
  for (const v of violations) {
    const tag = v.ruleName.startsWith("Socratic") ? "BINDING VIOLATION" : v.severity;
    parts.push(`- [${tag}] ${v.description}${v.suggestion ? ` → ${v.suggestion}` : ""}`);
  }

  process.stdout.write(parts.join("\n"));
}

/**
 * Binding patterns extracted from Socratic KSERO answers.
 * Each entry: if a verified answer matches answerPattern,
 * and code matches codePattern → violation.
 */
const SOCRATIC_BINDINGS = [
  {
    answerPattern: /(?:NEVER|must\s+NOT|MUST\s+not).*localStorage|localStorage.*(?:NEVER|must\s+NOT|forbidden)/i,
    codePattern: /localStorage\s*\.\s*(?:setItem|getItem)/g,
    ruleName: "Socratic Binding: localStorage Prohibition",
    description: "Socratic verified 'NEVER localStorage' but code uses localStorage",
    suggestion: "Use httpOnly cookies as verified in your Socratic answers",
  },
  {
    answerPattern: /(?:NEVER|must\s+NOT).*sessionStorage|sessionStorage.*(?:NEVER|must\s+NOT|forbidden)/i,
    codePattern: /sessionStorage\s*\.\s*(?:setItem|getItem)/g,
    ruleName: "Socratic Binding: sessionStorage Prohibition",
    description: "Socratic verified 'NEVER sessionStorage' but code uses sessionStorage",
    suggestion: "Use httpOnly cookies as verified in your Socratic answers",
  },
  {
    answerPattern: /parameterized\s+(?:SQL|queries)|(?:NEVER|must\s+NOT).*string\s+concatenat/i,
    codePattern: /\.prepare\s*\(\s*`[^`]*\$\{/g,
    ruleName: "Socratic Binding: SQL Parameterization",
    description: "Socratic verified 'parameterized SQL only' but template literal found in prepare()",
    suggestion: "Use ? placeholders in all SQL queries as verified in Socratic answers",
  },
  {
    answerPattern: /httpOnly\s+cookies?/i,
    codePattern: /localStorage\.setItem\s*\(\s*['"](?:token|jwt|auth|access|refresh)/gi,
    ruleName: "Socratic Binding: Token Storage",
    description: "Socratic verified 'httpOnly cookies' but tokens stored in localStorage",
    suggestion: "Store JWT tokens in httpOnly cookies, not localStorage",
  },
  {
    answerPattern: /bcrypt\s+cost\s+12/i,
    codePattern: /bcrypt\.hash(?:Sync)?\s*\([^,]+,\s*(?!12\b)(\d+)/g,
    ruleName: "Socratic Binding: bcrypt Cost Factor",
    description: "Socratic verified 'bcrypt cost 12' but different cost factor used",
    suggestion: "Use bcrypt cost factor 12 as verified in Socratic answers",
  },
];

/** Check code against Socratic verified (KSERO) answers. */
function checkSocraticBindings(changedFile: string): Violation[] {
  const violations: Violation[] = [];

  try {
    const db = getDatabase();
    const session = getActiveSession(db);
    if (!session) return violations;

    const answers = getAnswersBySession(db, session.id);
    const kseroAnswers = answers.filter((a) => a.confidence === "KSERO" && a.answer);
    if (kseroAnswers.length === 0) return violations;

    let content: string;
    try {
      content = readFileSync(changedFile, "utf-8");
    } catch {
      return violations;
    }

    // Combine all KSERO answer texts for pattern matching
    const allAnswerText = kseroAnswers.map((a) => a.answer).join(" ");

    for (const binding of SOCRATIC_BINDINGS) {
      if (!binding.answerPattern.test(allAnswerText)) continue;

      const codeRegex = new RegExp(binding.codePattern.source, binding.codePattern.flags);
      if (codeRegex.test(content)) {
        violations.push({
          ruleId: "00-socratic-binding", ruleName: binding.ruleName,
          severity: "critical", category: "security",
          filePath: changedFile, description: binding.description,
          suggestion: binding.suggestion,
        });
      }
    }
  } catch {
    // Non-critical — don't block on binding check failure
  }

  return violations;
}
