/*
 * DraxxCord Button Toggle v2 — Account Slot Edition
 * Only hides presentation slots mounted by the existing DraxxCord plugins.
 * No Vencord core edits, no Discord API calls and no removal of original buttons.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

const ROOT_ATTR = "data-draxxcord-button-toggle";
const CSS_ID = "vc-draxxcord-button-toggle-v2-css";
const SLOT_SELECTOR = ".vc-draxxcord-account-slot";
const SLOT_KEYS = ["stream-image", "umbral"] as const;

// These exact selectors come from accountPanelMount.ts in both source plugins.
// Hide the WHOLE slot div, not its inner button: no leftover flex space.
const SLOT_CSS = `
:root[${ROOT_ATTR}="hidden"] ${SLOT_SELECTOR}[data-draxxcord-slot="stream-image"],
:root[${ROOT_ATTR}="hidden"] ${SLOT_SELECTOR}[data-draxxcord-slot="umbral"] {
    display: none !important;
}
`;

const settings = definePluginSettings({
    hidden: {
        type: OptionType.BOOLEAN,
        description: "Hide the two DraxxCord account-area launcher slots, without disabling the plugins.",
        default: false,
        onChange: () => applyVisibility()
    }
});

function installCss(): void {
    if (document.getElementById(CSS_ID)) return;
    const style = document.createElement("style");
    style.id = CSS_ID;
    style.textContent = SLOT_CSS;
    document.head.appendChild(style);
}

function applyVisibility(): void {
    if (settings.store.hidden) {
        installCss();
        document.documentElement.setAttribute(ROOT_ATTR, "hidden");
    } else {
        document.documentElement.removeAttribute(ROOT_ATTR);
    }
}

function removeVisibility(): void {
    document.documentElement.removeAttribute(ROOT_ATTR);
    document.getElementById(CSS_ID)?.remove();
}

function getStatus(): string {
    const found = SLOT_KEYS.map(key => {
        const count = document.querySelectorAll(
            `${SLOT_SELECTOR}[data-draxxcord-slot="${key}"]`
        ).length;
        return `${key}: ${count} slot${count === 1 ? "" : "s"}`;
    });
    return `DraxxCord Buttons: **${settings.store.hidden ? "Hidden" : "Visible"}**. `
        + `Detected: ${found.join("; ")}. `
        + "Only the two custom launcher slots are affected.";
}

function runAction(action: string): string {
    switch (action) {
        case "hide":
            settings.store.hidden = true;
            break;
        case "show":
            settings.store.hidden = false;
            break;
        case "toggle":
            settings.store.hidden = !settings.store.hidden;
            break;
        case "status":
            return getStatus();
        default:
            return "Unknown action. Use hide, show, toggle or status.";
    }
    applyVisibility();
    return getStatus();
}

export default definePlugin({
    name: "DraxxCordButtonToggle",
    description: "Toggle DraxxCord Panel + CustomStreamImage account launchers with no empty slot (v2).",
    settings,
    commands: [{
        name: "draxxbuttons",
        description: "Hide or show DraxxCord Panel and Stream Image account buttons",
        inputType: ApplicationCommandInputType.BUILT_IN,
        options: [
            { name: "hide", description: "Hide both extra account buttons", type: ApplicationCommandOptionType.SUB_COMMAND },
            { name: "show", description: "Show both extra account buttons", type: ApplicationCommandOptionType.SUB_COMMAND },
            { name: "toggle", description: "Switch between hidden and visible", type: ApplicationCommandOptionType.SUB_COMMAND },
            { name: "status", description: "Check whether the two account slots are present", type: ApplicationCommandOptionType.SUB_COMMAND }
        ],
        execute(args, ctx) {
            // Response is local-only; it is not sent to other Discord users.
            sendBotMessage(ctx.channel.id, { content: runAction(args[0]?.name ?? "toggle") });
        }
    }],
    start() {
        // CSS reacts to future mounts automatically: no MutationObserver required.
        applyVisibility();
    },
    stop() {
        removeVisibility();
    }
});
