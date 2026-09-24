import { useEffect, useRef, useState, type FormEvent } from "react";
import { Flag, Loader2, X } from "lucide-react";
import { REPORT_CATEGORIES, type ReportCategory, type Target } from "@shared/types";
import { submitReport } from "@/lib/api";

export function ReportDialog({ target, open, onClose, onReported }: { target: Target; open: boolean; onClose: () => void; onReported: () => void }) {
    const ref = useRef<HTMLDialogElement>(null);
    const [category, setCategory] = useState<ReportCategory>("scam");
    const [description, setDescription] = useState("");
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            setMessage(null);
            d.showModal();
        } else if (!open && d.open) d.close();
    }, [open]);

    async function submit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setMessage(null);
        try {
            const res = await submitReport({ query: target.input, type: target.type, category, description: description.trim() || undefined });
            setMessage({ ok: true, text: res.message });
            if (!res.duplicate) onReported();
        } catch (err) {
            setMessage({ ok: false, text: (err as Error).message });
        } finally {
            setBusy(false);
        }
    }

    return (
        <dialog
            ref={ref}
            onClose={onClose}
            className="w-[min(92vw,480px)] rounded-2xl border border-white/10 bg-ink-900 p-0 text-slate-200 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        >
            <form onSubmit={submit} className="p-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                            <Flag className="h-5 w-5 text-rose-400" /> Report as malicious
                        </h2>
                        <p className="mt-1 break-all font-mono text-xs text-slate-400">{target.normalized.slice(0, 160)}</p>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <label className="mt-5 block text-sm font-medium text-slate-300">Category</label>
                <div className="mt-2 flex flex-wrap gap-2">
                    {REPORT_CATEGORIES.map((c) => (
                        <button
                            type="button"
                            key={c}
                            onClick={() => setCategory(c)}
                            className={`rounded-full border px-3 py-1 text-sm capitalize transition ${
                                category === c ? "border-rose-400/50 bg-rose-500/15 text-rose-200" : "border-white/10 text-slate-400 hover:text-white"
                            }`}
                        >
                            {c}
                        </button>
                    ))}
                </div>

                <label htmlFor="report-desc" className="mt-5 block text-sm font-medium text-slate-300">
                    What happened? <span className="text-slate-500">(optional, public)</span>
                </label>
                <textarea
                    id="report-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={1000}
                    rows={4}
                    placeholder="e.g. Called claiming to be my bank and asked for the SMS code. Don't include your own personal details."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-ink-950 p-3 text-sm text-white placeholder:text-slate-600 focus:border-brand-400/50 focus:outline-none"
                />

                {message && <p className={`mt-3 text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>{message.text}</p>}

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-ghost">
                        {message?.ok ? "Done" : "Cancel"}
                    </button>
                    {!message?.ok && (
                        <button type="submit" disabled={busy} className="btn bg-rose-500 text-white hover:bg-rose-400">
                            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit report
                        </button>
                    )}
                </div>
            </form>
        </dialog>
    );
}
