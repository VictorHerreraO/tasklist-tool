import { TaskEntry } from '../models/task.js';
import { TaskManager } from './taskManager.js';

/**
 * Result of a fuzzy search operation.
 */
export interface SmartResult {
    item: TaskEntry;
    score: number;
}

/**
 * Provides intelligent project discovery features including recency-based
 * retrieval and fuzzy searching.
 */
export class SmartResultProvider {
    /**
     * @param taskManager - The TaskManager instance to use for data access.
     */
    constructor(private readonly taskManager: TaskManager) { }

    /**
     * Returns the top 5 most recently active projects based on `updatedAt`.
     * 
     * @returns Array of most recently updated projects.
     */
    public getRecentProjects(): TaskEntry[] {
        const allProjects = this.taskManager.listTasks().filter(t => t.type === 'project');
        return [...allProjects]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, 5);
    }

    /**
     * Performs a fuzzy search against all projects.
     * 
     * Results are sorted by relevance score first, then by recency.
     * 
     * @param query - The search term.
     * @returns Ranked and sorted array of projects.
     */
    public searchProjects(query: string): TaskEntry[] {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return this.getRecentProjects();
        }

        const allProjects = this.taskManager.listTasks().filter(t => t.type === 'project');
        const results: SmartResult[] = allProjects
            .map(project => ({
                item: project,
                score: this.calculateMatchScore(project.id, trimmedQuery)
            }))
            .filter(res => res.score > 0);

        return results
            .sort((a, b) => {
                // Secondary sort by score (descending)
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                // Tertiary sort by recency (descending)
                return b.item.updatedAt - a.item.updatedAt;
            })
            .map(res => res.item);
    }

    /**
     * Simple fuzzy match algorithm that returns a score > 0 if there is a match.
     *
     * Scoring:
     * - Exact match (case-sensitive): 100
     * - Exact match (case-insensitive): 90
     * - Starts with (case-sensitive): 80
     * - Starts with (case-insensitive): 70
     * - Includes (case-sensitive): 50
     * - Includes (case-insensitive): 40
     * - Fuzzy subsequence match: 10-19
     */
    private calculateMatchScore(candidate: string, query: string): number {
        if (!query) return 0;

        const lowerCandidate = candidate.toLowerCase();
        const lowerQuery = query.toLowerCase();

        if (candidate === query) return 100;
        if (lowerCandidate === lowerQuery) return 90;
        if (candidate.startsWith(query)) return 80;
        if (lowerCandidate.startsWith(lowerQuery)) return 70;
        if (candidate.includes(query)) return 50;
        if (lowerCandidate.includes(lowerQuery)) return 40;

        // Fuzzy subsequence check: all characters of query must appear in order in candidate
        let qIdx = 0;
        for (let tIdx = 0; tIdx < lowerCandidate.length && qIdx < lowerQuery.length; tIdx++) {
            if (lowerCandidate[tIdx] === lowerQuery[qIdx]) {
                qIdx++;
            }
        }

        if (qIdx === lowerQuery.length) {
            // Score 10-19: baseline 10 plus a coverage bonus.
            // Coverage = query.length / candidate.length; max bonus is 9 (never 10,
            // because equal lengths would have matched as case-insensitive exact above).
            return 10 + Math.floor((lowerQuery.length / lowerCandidate.length) * 10);
        }

        return 0;
    }
}
