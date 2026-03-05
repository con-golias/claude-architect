/**
 * String casing utilities for consistent naming conventions.
 *
 * @module casing
 */

/**
 * Convert a string to kebab-case.
 *
 * @param str - Input string (camelCase, PascalCase, spaces, underscores)
 * @returns kebab-case string
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

/**
 * Convert a string to PascalCase.
 *
 * @param str - Input string (kebab-case, spaces, underscores)
 * @returns PascalCase string
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}
