/** Type declarations for the repo-hygiene guard (scripts/check-hygiene.mjs). */
export function findDuplicateKeys(text: string): string[];
export function trackedButIgnored(tracked: string[]): string[];
export function committedGeneratedArtifacts(tracked: string[]): string[];
export function collectProblems(): string[];
