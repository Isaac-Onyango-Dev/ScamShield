export type StorageMode = "ephemeral" | "persistent";

/**
 * Whether community reports and counters survive a restart on this deployment
 * (docs/REDESIGN_PLAN.md §4.8). The server fills <meta name="scamshield-storage"> from
 * STORAGE_PERSISTENT. If the page wasn't rendered by the server (the literal
 * "%STORAGE_MODE%" placeholder is still there) or the tag is missing, assume ephemeral:
 * the UI must never imply that reports are kept.
 */
export function storageMode(): StorageMode {
    const value = document.querySelector<HTMLMetaElement>('meta[name="scamshield-storage"]')?.content;
    if (!value || value === "%STORAGE_MODE%") return "ephemeral";
    return value === "persistent" ? "persistent" : "ephemeral";
}

export const STORAGE_NOTICE = "Reports are stored temporarily on this demo deployment and are cleared when the server restarts.";
export const STORAGE_NOTICE_SHORT = "Reports are stored temporarily on this demo deployment.";
