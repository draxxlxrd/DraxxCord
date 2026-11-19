import { Settings } from "@api/Settings";
/*
 * DraxxCord v6: visual friend-request counter, per-device only.
 * No Discord REST requests, no fake users, no mutation of real relationships.
 * getPendingCount is patched separately by the existing Umbral plugin.
 */
import { RelationshipStore, useState } from "@webpack/common";
import { forceDraxxRequestVisualRefresh, getDraxxRequestVisualStatus } from "./DraxxRequestBadgeVisuals";

const SETTINGS_KEY = "DraxxCordFakeRequestsState";
const LIMIT = 999999;
type Config = { enabled: boolean; count: number };
const INITIAL: Config = { enabled: false, count: 1023 };

function sanitize(input: unknown): Config {
    const value = input && typeof input === "object" ? input as Partial<Config> : {};
    const n = typeof value.count === "number" && Number.isFinite(value.count) ? Math.trunc(value.count) : INITIAL.count;
    return { enabled: value.enabled === true, count: Math.min(LIMIT, Math.max(0, n)) };
}
export function readFakeRequestConfig(): Config {
    try {
        return sanitize(Settings.plugins[SETTINGS_KEY]);
    } catch {
        return { ...INITIAL };
    }
}
export function shownFakeFriendRequestCount(realCount: number): number {
    const cfg = readFakeRequestConfig();
    return cfg.enabled ? cfg.count : realCount;
}
function saveConfig(next: Config) {
    const value = sanitize(next);
    const previous = Settings.plugins[SETTINGS_KEY];
    if (previous) {
        previous.enabled = value.enabled;
        previous.count = value.count;
    } else {
        Settings.plugins[SETTINGS_KEY] = { enabled: value.enabled, count: value.count };
    }
    const persisted = readFakeRequestConfig();
    if (persisted.enabled !== value.enabled || persisted.count !== value.count) {
        throw new Error("Fake Requests settings did not save");
    }
    try { (RelationshipStore as any).emitChange?.(); } catch { /* not ready */ }
    try { window.dispatchEvent(new Event("draxxcord:fake-requests-change")); } catch { /* not mounted */ }
}

export function DraxxFakeRequests() {
    const [cfg, setCfg] = useState<Config>(readFakeRequestConfig);
    const [input, setInput] = useState(String(cfg.count));
    const [storageError, setStorageError] = useState<string | null>(null);
    const [visualStatus, setVisualStatus] = useState(getDraxxRequestVisualStatus);
    const installed = typeof (RelationshipStore as any)?.dcRealPendingCount === "function";
    let real: number | null = null;
    try { if (installed) real = Number((RelationshipStore as any).dcRealPendingCount() || 0); } catch { /* store not ready */ }
    const apply = (enabled: boolean, count: number) => {
        const next = sanitize({ enabled, count });
        try {
            saveConfig(next);
            setCfg(next);
            setInput(String(next.count));
            setStorageError(null);
            setVisualStatus(forceDraxxRequestVisualRefresh());
        } catch (error) {
            setStorageError(String(error));
        }
    };
    const parsed = Number(input);
    const valid = /^\d{1,6}$/.test(input) && Number.isInteger(parsed) && parsed >= 0 && parsed <= LIMIT;

    return <div className="draxx-friendcount-panel">
        <div className="draxx-friendcount-header">FAKE FRIEND REQUESTS <span>LOCAL ONLY</span></div>
        <p className="draxx-friendcount-info">Changes the number displayed by Discord's native incoming friend-request counter. No real friend requests are sent or created, and the Pending list still contains only actual requests.</p>
        {!installed && <div className="draxx-friendcount-warning">Native Discord count patch not detected. Restart Discord after Build/Inject; if it remains missing, this Discord version requires a patch update.</div>}
        <label className="draxx-friendcount-switch">
            <input type="checkbox" checked={cfg.enabled} onChange={e => apply(e.currentTarget.checked, cfg.count)} />
            <span>Enable custom incoming request count</span>
        </label>
        <label className="draxx-friendcount-number-label" htmlFor="draxx-request-count">Amount (0–999999)</label>
        <div className="draxx-friendcount-input-row">
            <input id="draxx-request-count" type="number" min="0" max={LIMIT} step="1" value={input} onChange={e => setInput(e.currentTarget.value)} />
            <button type="button" disabled={!valid} onClick={() => apply(cfg.enabled, parsed)}>Apply</button>
        </div>
        <div className="draxx-friendcount-presets">
            {[0, 99, 999, 1023, 9999].map(n => <button key={n} type="button" onClick={() => apply(cfg.enabled, n)}>{n.toLocaleString("en-US")}</button>)}
        </div>
        {storageError && <div className="draxx-friendcount-warning">Settings save failed: {storageError}</div>}
        <div className="draxx-friendcount-preview">
            <span>Friends / Pending</span>
            <strong>{cfg.enabled ? cfg.count.toLocaleString("en-US") : "REAL"}</strong>
        </div>
        <div className="draxx-friendcount-meta">Real pending count: {real === null ? "Unavailable" : real.toLocaleString("en-US")} · Saved locally; survives Discord reload</div>
        <button type="button" className="draxx-friendcount-reset" onClick={() => setVisualStatus(forceDraxxRequestVisualRefresh())}>Refresh Discord badges / Diagnostics</button>
        <div className="draxx-friendcount-meta">Visual sync: {visualStatus}</div>
        <button type="button" className="draxx-friendcount-reset" onClick={() => apply(false, INITIAL.count)}>Disable &amp; restore real counter</button>
    </div>;
}
