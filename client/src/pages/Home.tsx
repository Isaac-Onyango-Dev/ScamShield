import { useState } from "react";
import { SearchBar } from "@/components/SearchBar";
import { StatsDisplay } from "@/components/StatsDisplay";
import { SearchResults } from "@/components/SearchResults";
import { useSearch } from "@/lib/api";

export function HomePage() {
    const [searchResults, setSearchResults] = useState<any>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const { search, isLoading } = useSearch();

    const handleSearch = async (content: string, type: string) => {
        try {
            const results = await search(content, type as any);
            setSearchResults(results);
            setHasSearched(true);
        } catch (error) {
            console.error("Search error:", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <SearchBar onSearch={handleSearch} isLoading={isLoading} />

            {/* Stats Section */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {!hasSearched && <StatsDisplay />}
            </div>

            {/* Results Section */}
            {searchResults && (
                <div className="bg-white border-t border-gray-200">
                    <SearchResults
                        content={searchResults.content}
                        type={searchResults.type}
                        analysis={searchResults.analysis}
                        communityReports={searchResults.communityReports}
                    />
                </div>
            )}

            {/* Info Section */}
            {!hasSearched && (
                <div className="bg-white py-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold mb-8 text-center">How ScamShield Works</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    1
                                </div>
                                <h3 className="font-semibold mb-2">Enter Your Query</h3>
                                <p className="text-gray-600">
                                    Type a phone number, email address, domain, or IP address to check.
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    2
                                </div>
                                <h3 className="font-semibold mb-2">AI Analysis</h3>
                                <p className="text-gray-600">
                                    Our AI checks for scam patterns and cross-references with community reports.
                                </p>
                            </div>
                            <div className="text-center">
                                <div className="w-12 h-12 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg">
                                    3
                                </div>
                                <h3 className="font-semibold mb-2">Get Results</h3>
                                <p className="text-gray-600">
                                    Receive a risk score and recommendations to stay safe.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
