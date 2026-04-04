import { useCallback, useState } from "react";
import type { ContentType } from "@shared/types";

export function useSearch() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState(null);

    const search = useCallback(
        async (content: string, type: ContentType) => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/search/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content, type }),
                });

                if (!response.ok) {
                    throw new Error("Search failed");
                }

                const result = await response.json();
                setData(result);
                return result;
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return { search, isLoading, error, data };
}

export function useReportScam() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const report = useCallback(
        async (content: string, contentType: ContentType, reportType: string, description?: string) => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch("/api/search/reports", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        content,
                        contentType,
                        reportType,
                        description,
                    }),
                });

                if (!response.ok) {
                    throw new Error("Report failed");
                }

                return await response.json();
            } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                setError(message);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        []
    );

    return { report, isLoading, error };
}
