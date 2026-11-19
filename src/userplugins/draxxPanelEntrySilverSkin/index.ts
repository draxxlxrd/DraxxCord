/*
 * DraxPanel Entry Silver Skin (cosmetic-only userplugin)
 * DRAXX_ENTRY_SILVER_PLUGIN
 * Does not change DraxPanel text, React components, storage, or commands.
 * Activates only when a DraxPanel entry screen displays "Connect to Discord".
 */
import "./styles.css";
import definePlugin from "@utils/types";

const ROOT = ".selfbot-menu-container";
const SKIN = "draxx-entry-silver";
const CONNECTION_TEXT = /\bconnect(?:ing)?\s+(?:to\s+)?discord\b/i;
let observer: MutationObserver | null = null;
let pendingFrame: number | null = null;

function isEntryVisible(root: Element): boolean {
    // Content-based detection. Text nodes are READ only; labels are never modified.
    const candidates = root.querySelectorAll("button, a, [role=button], h1, h2, h3, p, span");
    for (const node of candidates) {
        const text = node.textContent?.trim() ?? "";
        if (text.length > 0 && text.length < 130 && CONNECTION_TEXT.test(text)) {
            // Only visible text on the entry screen can trigger the skin.
            const item = node as HTMLElement;
            if (item.getClientRects().length && getComputedStyle(item).visibility !== "hidden") {
                return true;
            }
        }
    }
    return false;
}

function scan(): void {
    pendingFrame = null;
    try {
        document.querySelectorAll(ROOT).forEach(root => {
            root.classList.toggle(SKIN, isEntryVisible(root));
        });
    } catch (error) {
        console.warn("DraxPanel Entry Silver Skin: cosmetic scan failed", error);
    }
}

function scheduleScan(): void {
    if (pendingFrame === null) pendingFrame = requestAnimationFrame(scan);
}

export default definePlugin({
    name: "DraxPanelEntrySilverSkin",
    description: "Black and silver styling for DraxPanel's Discord connection entry page. No text or behavior changes.",
    authors: [{ name: "Draxx", id: 1170048531281743922n }],
    enabledByDefault: true,
    start() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(scheduleScan);
        observer.observe(document.body, { childList: true, characterData: true, subtree: true });
        scheduleScan();
    },
    stop() {
        observer?.disconnect();
        observer = null;
        if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
        document.querySelectorAll(`${ROOT}.${SKIN}`).forEach(node => node.classList.remove(SKIN));
    },
});
