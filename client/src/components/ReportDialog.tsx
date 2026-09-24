import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { REPORT_CATEGORIES, type ReportCategory, type Target } from "@shared/types";
import { ApiError, submitReport } from "@/lib/api";
import { cn } from "@/lib/cn";
import { STORAGE_NOTICE, type StorageMode } from "@/lib/deployment";
import { Button } from "@/components/ui/Button";
import { InlineAlert } from "@/components/ui/InlineAlert";
import { Spinner } from "@/components/ui/Spinner";

const MAX = 1000;

type Outcome = { tone: "success" | "info" | "warning" | "danger"; text: string; final: boolean };

/**
 * Community report form in a native modal <dialog>: focus is trapped while open and returns
 * to the "Report…" button on close. Categories are real radios (fieldset + legend).
 */
export function ReportDialog({
    target,
    open,
    onClose,
    onReported,
    storage,
}: {
    target: Target;
    open: boolean;
    onClose: () => void;
    onReported: () => void;
    storage: StorageMode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const ids = { title: useId(), description: useId(), helper: useId() };
    const [category, setCategory] = useState<ReportCategory>("scam");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            setOutcome(null);
            d.showModal();
            d.querySelector<HTMLInputElement>('input[name="report-category"]:checked')?.focus();
        } else if (!open && d.open) d.close();
    }, [open]);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setOutcome(null);
        try {
            const res = await submitReport({ query: target.input, type: target.type, category, description: description.trim() || undefined });
            setOutcome({ tone: res.duplicate ? "info" : "success", text: res.message, final: true });
            if (!res.duplicate) onReported();
        } catch (err) {
            if (err instanceof ApiError && err.status === 429) setOutcome({ tone: "warning", text: "Too many reports from your network. Try again later.", final: false });
            else setOutcome({ tone: "danger", text: (err as Error).message, final: false });
        } finally {
            setBusy(false);
        }
    }

    return (
        <dialog ref={ref} aria-labelledby={ids.title} onClose={onClose} className="w-full max-w-lg rounded-lg border border-line bg-surface p-0 text-fg shadow-overlay">
            <form onSubmit={submit} className="flex flex-col gap-5 p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id={ids.title} className="text-title-3 font-semibold">
                            Report this lookup
                        </h2>
                        <p className="mt-1 break-all font-mono text-caption text-fg-secondary">{target.normalized.slice(0, 160)}</p>
                    </div>
                    <Button variant="plain" size="sm" onClick={onClose} aria-label="Close" className="h-8 w-8 rounded-md text-fg-secondary hover:bg-surface-2 hover:text-fg hover:no-underline">
                        <X className="h-4 w-4" aria-hidden />
                    </Button>
                </div>

                <fieldset className="flex flex-col gap-2">
                    <legend className="mb-2 text-footnote font-semibold">Category</legend>
                    <div className="flex flex-wrap gap-2">
                        {REPORT_CATEGORIES.map((c) => (
                            <label
                                key={c}
                                className={cn(
                                    "cursor-pointer rounded-md border px-3 py-1 text-footnote capitalize transition-colors duration-fast has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus",
                                    category === c ? "border-accent bg-accent-tint font-semibold text-accent" : "border-line-strong text-fg-secondary hover:text-fg",
                                )}
                            >
                                <input type="radio" name="report-category" value={c} checked={category === c} onChange={() => setCategory(c)} className="sr-only" />
                                {c}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div className="flex flex-col gap-2">
                    <label htmlFor={ids.description} className="text-footnote font-semibold">
                        What happened? <span className="font-normal text-fg-tertiary">(optional)</span>
                    </label>
                    <textarea
                        id={ids.description}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={MAX}
                        rows={4}
                        aria-describedby={ids.helper}
                        className="w-full rounded-md border border-line-strong bg-surface p-3 text-footnote text-fg placeholder:text-fg-tertiary"
                    />
                    <div className="flex justify-between gap-4 text-caption text-fg-tertiary">
                        <p id={ids.helper}>Public. Don't include your own personal details.</p>
                        <p className="tabular" aria-hidden>
                            {description.length} / {MAX}
                        </p>
                    </div>
                </div>

                {storage === "ephemeral" && <InlineAlert tone="info">{STORAGE_NOTICE}</InlineAlert>}
                {outcome && <InlineAlert tone={outcome.tone}>{outcome.text}</InlineAlert>}

                <div className="flex justify-end gap-2">
                    <Button onClick={onClose}>{outcome?.final ? "Done" : "Cancel"}</Button>
                    {!outcome?.final && (
                        <Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>
                            {busy && <Spinner tone="on-accent" />}
                            Submit report
                        </Button>
                    )}
                </div>
            </form>
        </dialog>
    );
}
