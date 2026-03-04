/**
 * MCP tool parameter and response type definitions.
 *
 * @module mcp-types
 */

export interface ArchitectCheckParams {
  project_path: string;
  categories?: string[];
  severity?: "critical" | "warning" | "info";
  fix?: boolean;
}

export interface ArchitectScaffoldParams {
  project_path: string;
  feature_name: string;
  description?: string;
  layers?: string[];
  with_tests?: boolean;
}

export interface ArchitectLogDecisionParams {
  project_path: string;
  title: string;
  context: string;
  decision: string;
  alternatives?: Array<{ name: string; pros: string[]; cons: string[] }>;
  tags?: string[];
}

export interface ArchitectSearchParams {
  query?: string;
  project_path?: string;
  type?: "decisions" | "violations" | "changes" | "sessions";
  status?: string;
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  offset?: number;
}

export interface ArchitectTimelineParams {
  anchor?: number;
  query?: string;
  project_path?: string;
  depth_before?: number;
  depth_after?: number;
}

export interface ArchitectGetDetailsParams {
  ids: number[];
  type: "decisions" | "violations" | "changes";
}

export interface ArchitectGetStatusParams {
  project_path: string;
}

export interface ArchitectGetRulesParams {
  file_path?: string;
  category?: string;
}

export interface ArchitectImproveParams {
  project_path?: string;
  min_sessions?: number;
}
