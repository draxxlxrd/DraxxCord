/*
 * DraxxCord compatibility port of AntiNickname (2026 original preserved separately).
 * SPDX-License-Identifier: GPL-3.0-or-later
 * This only requests changes to the CURRENT account's own nickname.
 */
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    active: { type: OptionType.BOOLEAN, description: "Opt in to removing forced nicknames", default: false },
    guildIds: { type: OptionType.STRING, description: "Allowed server IDs, comma-separated (required)", default: "" }
});
const lastAttempt = new Map<string, number>();
const allowedGuild = (id: string) => settings.store.guildIds.split(",").map(v => v.trim()).filter(Boolean).includes(id);
async function clearOwnNickname(guildId: string) {
    try {
        await RestAPI.patch({ url: `/users/@me/guilds/${guildId}/profile`, body: { nick: null } });
    } catch (e) {
        try { await RestAPI.patch({ url: `/guilds/${guildId}/members/@me`, body: { nick: "" } }); }
        catch (inner) { console.warn("[DraxxCord AntiNickname] Could not reset own nickname:", inner); }
    }
}
export default definePlugin({
    name: "DraxxCord AntiNickname",
    description: "Opt-in: resets nicknames forced on your own account in specified servers. Ported from the selected source.",
    authors: [{ name: "Original b4lCord contributors", id: 0n }],
    settings,
    flux: {
        GUILD_MEMBER_UPDATE(event: any) {
            if (!settings.store.active) return;
            const guildId = event.guildId ?? event.guild_id;
            const userId = event.user?.id ?? event.member?.user?.id ?? event.userId;
            const nickname = event.nick ?? event.member?.nick;
            if (!guildId || !allowedGuild(guildId) || !nickname || userId !== UserStore.getCurrentUser()?.id) return;
            const now = Date.now();
            if (now - (lastAttempt.get(guildId) ?? 0) < 30_000) return;
            lastAttempt.set(guildId, now);
            void clearOwnNickname(guildId);
        }
    },
    stop() { lastAttempt.clear(); }
});
