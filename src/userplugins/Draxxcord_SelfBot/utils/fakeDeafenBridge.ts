// DRAXXCORD_BRIDGE_V12_1_MARKER
/*
 * DraxxCord - v12.1 initialization bridge for original FakeDeafen (hyyven).
 * The user-supplied vendorFakeDeafen/upstream.tsx and settings.ts are UNMODIFIED.
 * Original FakeDeafen retains copyright/license attribution.
 * This adapter does not modify user authentication or Discord tokens.
 */
import { Settings } from "@api/Settings";
import { findByProps } from "@webpack";
import OriginalFakeDeafen from "../vendorFakeDeafen/upstream";
import OriginalSettings from "../vendorFakeDeafen/settings";

const PARENT_PLUGIN_NAME = "DraxxCord Gothic";
type UpstreamPlugin = { start(): void; stop(): void; };
const upstream = OriginalFakeDeafen as unknown as UpstreamPlugin;
let started = false;
let enabled = false;

function initializeOriginalSettings(): void {
    // Because this vendor plugin is imported as a module rather than auto-
    // registered as a standalone Vencord plugin, Vencord never sets its
    // definedSettings.pluginName. Fix that before accessing .store.
    const parentSettings = Settings.plugins[PARENT_PLUGIN_NAME] as Record<string, any> | undefined;
    if (!parentSettings) {
        throw new Error(`DraxxCord plugin settings not ready (${PARENT_PLUGIN_NAME})`);
    }

    OriginalSettings.pluginName = PARENT_PLUGIN_NAME;
    // Use settings for the enabled parent plugin, not an orphan plugin entry.
    // The upstream source itself reads these four keys unchanged.
    const originalStore = OriginalSettings.store;
    originalStore.fakeDeafen = true;
    originalStore.fakeMute = true;
    originalStore.enableKeybind = true;
    originalStore.showButton = false;
}

function sendUpstreamToggle(): void {
    window.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Q",
        code: "KeyQ",
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true
    }));
}

export function setOriginalFakeDeafen(desired: boolean): void {
    if (desired === enabled) return;

    initializeOriginalSettings();
    const gateway = findByProps("getSocket") as any;
    const socket = gateway?.getSocket?.();
    if (!socket || typeof socket.send !== "function") {
        throw new Error("Discord voice gateway socket not ready");
    }

    if (!started) {
        upstream.start();
        started = true;
    }

    sendUpstreamToggle();
    enabled = desired;
}

export function stopOriginalFakeDeafen(): void {
    if (!started) return;
    try {
        if (enabled) sendUpstreamToggle();
    } finally {
        try { upstream.stop(); } finally {
            started = false;
            enabled = false;
        }
    }
}
