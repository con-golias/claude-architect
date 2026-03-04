/**
 * Type definitions for the architecture validation engine.
 *
 * @module validation-types
 */

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  category: "dependency" | "structure" | "security" | "quality" | "docs";
  filePath?: string;
  lineNumber?: number;
  description: string;
  suggestion?: string;
}

export interface ValidationResult {
  violations: Violation[];
  scannedFiles: number;
  scannedFeatures: string[];
  duration: number;
}

export interface ComplianceReport {
  overallScore: number;
  scoresByCategory: Record<string, number>;
  totalFeatures: number;
  totalFiles: number;
  violations: Violation[];
  featureMap: FeatureInfo[];
  trend: "improving" | "stable" | "declining";
  timestamp: number;
}

export interface FeatureInfo {
  name: string;
  path: string;
  hasReadme: boolean;
  hasDomain: boolean;
  hasApplication: boolean;
  hasInfrastructure: boolean;
  hasTests: boolean;
  violationCount: number;
}

export interface CheckerResult {
  violations: Violation[];
  filesScanned: number;
}
