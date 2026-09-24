export interface LintResult {
    id: string;
    title: string;
    count: number;
    hits: string[];
    detail?: string;
    na?: string;
}
export function lintFiles(files: Record<string, string>): LintResult[];
export function loadRepoFiles(root?: string): Record<string, string>;
export const RULES: { id: string; title: string }[];
export const TOKEN_RULES: { id: string; title: string }[];
