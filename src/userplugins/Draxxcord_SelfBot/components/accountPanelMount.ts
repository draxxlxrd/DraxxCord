/*
 * DraxxCord v4 — account-panel launchers.
 * Places Stream Image and Umbral immediately to the left of Discord's native
 * Mic/Headphones/Settings controls, preserving a deterministic icon order.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

type Render = (node: HTMLDivElement) => () => void;

const panelSelector = '[class^="panels_"], [class*=" panels_"]';
const settingsHints = ["user settings", "settings", "paramètres utilisateur", "paramètres", "الإعدادات"];
const priority = ["stream-image", "umbral"];
const slotClass = "vc-draxxcord-account-slot";

function isDraxxSlot(element: Element): element is HTMLElement {
    return element instanceof HTMLElement && element.classList.contains(slotClass);
}

function findButtonsRow(): HTMLElement | null {
    const panels = document.querySelectorAll<HTMLElement>(panelSelector);
    for (const panel of panels) {
        const items = panel.querySelectorAll<HTMLElement>("[aria-label], [data-list-item-id], [title]");
        for (const item of items) {
            const label = [item.getAttribute("aria-label"), item.getAttribute("data-list-item-id"), item.getAttribute("title")]
                .filter(Boolean).join(" ").toLowerCase();
            if (!settingsHints.some(hint => label.includes(hint))) continue;
            const button = (item.closest("button, [role='button']") || item) as HTMLElement;
            const row = button.parentElement;
            if (!row || !panel.contains(row) || row.getBoundingClientRect().width < 25) continue;
            return row;
        }
    }
    return null;
}

function placeButtonsOnLeft(row: HTMLElement): void {
    const children = Array.from(row.children);
    const slots = children.filter(isDraxxSlot);
    if (!slots.length) return;

    const order = (element: HTMLElement) => {
        const n = priority.indexOf(element.dataset.draxxcordSlot ?? "");
        return n < 0 ? priority.length : n;
    };
    const sorted = [...slots].sort((a, b) => order(a) - order(b));
    // Put the DraxxCord buttons before the *first native account control*,
    // not merely before the Settings gear (which kept them on the far right).
    const firstNative = children.find(child => !isDraxxSlot(child));
    if (!firstNative) return;

    // No-op once ordered: prevents endless MutationObserver/React loops.
    if (sorted.every((slot, i) => children[i] === slot)) return;
    for (const slot of sorted) row.insertBefore(slot, firstNative);
}

export function mountAccountButton(key: string, render: Render): () => void {
    let holder: HTMLDivElement | null = null;
    let cleanup: (() => void) | null = null;
    let stopped = false;
    let syncing = false;

    const sync = () => {
        if (stopped || syncing) return;
        syncing = true;
        try {
            const row = findButtonsRow();
            if (!row || (holder && holder.parentElement !== row)) {
                cleanup?.();
                cleanup = null;
                holder?.remove();
                holder = null;
            }
            if (!row) return;
            if (!holder) {
                const node = document.createElement("div");
                node.className = slotClass;
                node.dataset.draxxcordSlot = key;
                // Initial insertion and subsequent sorting are independent
                // of which plugin starts first.
                row.insertBefore(node, row.firstChild);
                holder = node;
                try {
                    cleanup = render(node);
                } catch (error) {
                    console.error("[DraxxCord] Failed to mount account button", key, error);
                    node.remove();
                    holder = null;
                }
            }
            placeButtonsOnLeft(row);
        } finally {
            syncing = false;
        }
    };

    const observer = new MutationObserver(sync);
    const begin = () => {
        if (stopped) return;
        sync();
        observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) begin();
    else document.addEventListener("DOMContentLoaded", begin, { once: true });

    return () => {
        stopped = true;
        document.removeEventListener("DOMContentLoaded", begin);
        observer.disconnect();
        cleanup?.();
        cleanup = null;
        holder?.remove();
        holder = null;
    };
}
