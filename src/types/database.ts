/**
 * Database record type definitions for claude-architect.
 * Maps directly to SQLite table schemas.
 *
 * @module database-types
 */

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  tech_stack: string | null;
  architecture_pattern: string;
  enabled_manual_rules: string;
  created_at: number;
  updated_at: number;
}

export interface DecisionRecord {
  id: number;
  project_id: string;
  session_id: string | null;
  title: string;
  status: "proposed" | "accepted" | "deprecated" | "superseded";
  context: string | null;
  decision: string;
  alternatives: string | null;
  consequences_positive: string | null;
  consequences_negative: string | null;
  superseded_by: number | null;
  tags: string | null;
  created_at: number;
}

export interface ViolationRecord {
  id: number;
  project_id: string;
  session_id: string | null;
  rule_id: string;
  rule_name: string;
  severity: "critical" | "warning" | "info";
  category: "dependency" | "structure" | "security" | "quality" | "docs";
  file_path: string | null;
  line_number: number | null;
  description: string;
  suggestion: string | null;
  resolved: number;
  resolved_at: number | null;
  resolved_by: string | null;
  created_at: number;
}

export interface SessionRecord {
  id: string;
  project_id: string;
  started_at: number;
  completed_at: number | null;
  summary: string | null;
  features_added: string | null;
  files_changed: string | null;
  decisions_made: number;
  violations_found: number;
  violations_resolved: number;
  compliance_score_before: number | null;
  compliance_score_after: number | null;
}

export interface StructuralChangeRecord {
  id: number;
  project_id: string;
  session_id: string | null;
  change_type: string;
  entity_name: string;
  description: string;
  details: string | null;
  created_at: number;
}

export interface RuleMetricRecord {
  id: number;
  project_id: string | null;
  rule_id: string;
  total_violations: number;
  resolved_violations: number;
  ignored_violations: number;
  avg_resolution_time_ms: number | null;
  last_violation_at: number | null;
  updated_at: number;
}

export interface ImprovementSuggestionRecord {
  id: number;
  project_id: string | null;
  rule_id: string | null;
  suggestion_type: "relax" | "tighten" | "split" | "merge" | "add" | "remove";
  title: string;
  reasoning: string;
  evidence: string | null;
  status: "pending" | "applied" | "dismissed";
  applied_at: number | null;
  created_at: number;
}

export interface ComplianceSnapshotRecord {
  id: number;
  project_id: string;
  session_id: string | null;
  overall_score: number;
  scores_by_category: string;
  total_features: number;
  total_files: number;
  total_violations: number;
  violations_by_severity: string;
  violations_by_rule: string;
  created_at: number;
}

/** Unified search result for the 3-layer workflow */
export interface SearchResultItem {
  id: number;
  type: "decision" | "violation" | "change" | "session";
  title: string;
  status: string;
  created_at: number;
  extra: string;
}
