import { useState, FormEvent } from "react";
import { Search } from "lucide-react";

interface SearchBarProps {
    onSearch: (content: string, type: string) => void;
    isLoading?: boolean;
}

export function SearchBar({ onSearch, isLoading }: SearchBarProps) {
    const [input, setInput] = useState("");
    const [type, setType] = useState("text");

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (input.trim()) {
            onSearch(input.trim(), type);
        }
    };

    // Auto-detect type
    const detectType = (value: string) => {
        if (/^\+?1?\d{10,15}$/.test(value.replace(/\D/g, ""))) return "phone";
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
        if (/^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/.test(value)) return "domain";
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) return "ip";
        return "text";
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInput(value);
        if (value.trim()) {
            const detectedType = detectType(value);
            setType(detectedType);
        }
    };

    return (
        <div className="w-full bg-gradient-to-r from-slate-900 to-slate-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                <h1 className="text-4xl font-bold text-white text-center mb-2">
                    ScamShield
                </h1>
                <p className="text-gray-300 text-center mb-8">
                    Check if a phone, email, or domain is a scam
                </p>

                <form onSubmit={handleSubmit} className="relative">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder='Enter phone, email, domain, or IP...'
                                value={input}
                                onChange={handleInputChange}
                                className="w-full pl-12 pr-4 py-3 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                disabled={isLoading}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? "Analyzing..." : "Search"}
                        </button>
                    </div>

                    {input && (
                        <p className="mt-2 text-sm text-gray-300">
                            Type: <span className="font-semibold text-blue-300">{type}</span>
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}
