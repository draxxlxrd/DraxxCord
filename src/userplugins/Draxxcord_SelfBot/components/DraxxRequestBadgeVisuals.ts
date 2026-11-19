import { Settings } from "@api/Settings";
/*
 * DraxxCord Request Badge Sync v6.4
 * Cosmetic-only update of the three request counters, with diagnostics.
 * No network calls, Discord relationships, tokens, or other notification counts are modified.
 * Inspired by the source-level counter approach in Vencord's NoPendingCount and
 * reqonpublishes/vencord-custom-plugins FakeNotifications (GPL-3.0-or-later).
 */
import { RelationshipStore } from "@webpack/common";

const SETTINGS_KEY = "DraxxCordFakeRequestsState";
const ORIGINAL = "data-draxx-requests-original";
const AREA = "data-draxx-requests-region";
let observer: MutationObserver | undefined;
let ticker: number | undefined;
let pending: number | undefined;
let status = "Not started";

interface Options { enabled: boolean; count: number; }
function config(): Options {
    try {
        const value = Settings.plugins[SETTINGS_KEY];
        const count = typeof value?.count === "number" && Number.isFinite(value.count) ? Math.trunc(value.count) : 0;
        return { enabled: value?.enabled === true, count: Math.min(999999, Math.max(0, count)) };
    } catch {
        return { enabled: false, count: 0 };
    }
}

function realPending(): number | null {
    try {
        const r = (RelationshipStore as any)?.dcRealPendingCount?.();
        return Number.isFinite(r) ? Number(r) : null;
    } catch { return null; }
}

function nativeShown(): number | null {
    try {
        const r = (RelationshipStore as any)?.getPendingCount?.();
        return Number.isFinite(r) ? Number(r) : null;
    } catch { return null; }
}

function parsedBadge(el: Element): number | null {
    const str = (el.textContent || "").trim().replace(/[,\s]/g, "");
    if (!/^\d{1,6}\+?$/.test(str)) return null;
    const n = Number(str.replace(/\+$/, ""));
    return Number.isFinite(n) ? n : null;
}

function bounds(el: Element): DOMRect | null {
    if (!(el instanceof HTMLElement) || !el.isConnected || el.closest(".selfbot-menu-container")) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.width < 400 && r.height < 80 ? r : null;
}

function badgeLeaves(root: Element): HTMLElement[] {
    const elements = root.querySelectorAll("span, div, strong, b, sup");
    const out: HTMLElement[] = [];
    for (const node of elements) {
        if (!(node instanceof HTMLElement) || node.children.length !== 0 || !bounds(node)) continue;
        if (parsedBadge(node) !== null) out.push(node);
    }
    return out;
}

/** Nearest badge to the actual Friends sidebar / Pending tab label. */
function findByLabel(label: "Friends" | "Pending", real: number | null): HTMLElement | null {
    let closest: HTMLElement | null = null;
    let score = Number.POSITIVE_INFINITY;
    const pageNodes = document.querySelectorAll("span, div, a, button, strong");
    for (const labelEl of pageNodes) {
        if (labelEl.children.length > 0 || labelEl.textContent?.trim() !== label) continue;
        const lr = bounds(labelEl);
        if (!lr) continue;
        if (label === "Friends" && (lr.left > 370 || lr.top < 65 || lr.top > 310)) continue;
        if (label === "Pending" && (lr.left < 250 || lr.top > 120)) continue;
        let parent = labelEl.parentElement;
        for (let depth = 0; parent && depth < 7; parent = parent.parentElement, depth++) {
            const pr = parent.getBoundingClientRect();
            if (pr.height > 140) break;
            for (const candidate of badgeLeaves(parent)) {
                const cr = candidate.getBoundingClientRect();
                const distY = Math.abs(cr.top + cr.height / 2 - (lr.top + lr.height / 2));
                const gapX = cr.left - lr.right;
                const original = candidate.getAttribute(ORIGINAL);
                const value = original ? Number(original.replace(/\D/g, "")) : parsedBadge(candidate);
                if (gapX < -18 || gapX > 335 || distY > 25) continue;
                if (real !== null && value !== real && !candidate.hasAttribute(ORIGINAL)) continue;
                // Discord's numeric badges are generally compact and right of the label.
                const next = distY * 5 + gapX + depth * 3;
                if (next < score) { score = next; closest = candidate; }
            }
            if (closest && score < 140) break;
        }
    }
    return closest;
}

function show(node: HTMLElement, number: number, region: string) {
    if (!node.hasAttribute(ORIGINAL)) node.setAttribute(ORIGINAL, node.textContent || "");
    node.setAttribute(AREA, region);
    const wanted = String(number);
    if (node.textContent !== wanted) node.textContent = wanted;
    node.style.setProperty("max-width", "none", "important");
    node.style.setProperty("min-width", "20px", "important");
    node.style.setProperty("width", "max-content", "important");
    node.style.setProperty("white-space", "nowrap", "important");
    node.style.setProperty("padding-inline", "5px", "important");
}

function restore() {
    document.querySelectorAll<HTMLElement>(`[${ORIGINAL}]`).forEach(node => {
        const old = node.getAttribute(ORIGINAL);
        if (old !== null && node.textContent !== old) node.textContent = old;
        node.removeAttribute(ORIGINAL);
        node.removeAttribute(AREA);
        for (const prop of ["max-width", "min-width", "width", "white-space", "padding-inline"]) node.style.removeProperty(prop);
    });
}

/* DRAXX_SAFE_BADGE_ISOLATION_V66
 * Fake count is shown ONLY on Friends / Pending.
 * Home, server, DM and message-request badges are never overwritten by DOM sync.
 */
function restoreUnrelatedBadgeOverrides() {
    document.querySelectorAll<HTMLElement>(`[${AREA}="home"]`).forEach(node => {
        const original = node.getAttribute(ORIGINAL);
        if (original !== null && node.textContent !== original) node.textContent = original;
        node.removeAttribute(ORIGINAL);
        node.removeAttribute(AREA);
        for (const property of ["max-width", "min-width", "width", "white-space", "padding-inline"]) {
            node.style.removeProperty(property);
        }
    });
}
function update() {
    restoreUnrelatedBadgeOverrides();
    const cfg = config();
    const real = realPending();
    const native = nativeShown();
    if (!cfg.enabled) { restore(); status = `OFF | real: ${real ?? "unknown"}`; return; }
    const friend = findByLabel("Friends", real);
    const pendingBadge = findByLabel("Pending", real);
    if (friend) show(friend, cfg.count, "friends");
    if (pendingBadge) show(pendingBadge, cfg.count, "pending");
    status = `Saved ${cfg.count} | native ${native ?? "N/A"} | real ${real ?? "N/A"} | Friends ${friend ? "OK" : "not found"} | Pending ${pendingBadge ? "OK" : "not found"} | Home native only`;
}

function schedule() {
    if (pending !== undefined) return;
    pending = window.setTimeout(() => { pending = undefined; update(); }, 120);
}

export function forceDraxxRequestVisualRefresh(): string {
    try { (RelationshipStore as any)?.emitChange?.(); } catch { /* optional */ }
    update();
    return status;
}
export function getDraxxRequestVisualStatus(): string { return status; }

export function startDraxxRequestBadgeVisuals() {
    stopDraxxRequestBadgeVisuals();
    if (!document.body) { ticker = window.setTimeout(startDraxxRequestBadgeVisuals, 500); return; }
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    ticker = window.setInterval(schedule, 1600);
    window.addEventListener("draxxcord:fake-requests-change", schedule);
    update();
}
export function stopDraxxRequestBadgeVisuals() {
    observer?.disconnect();
    observer = undefined;
    if (ticker !== undefined) { window.clearInterval(ticker); window.clearTimeout(ticker); ticker = undefined; }
    if (pending !== undefined) { window.clearTimeout(pending); pending = undefined; }
    window.removeEventListener("draxxcord:fake-requests-change", schedule);
    restore();
}
