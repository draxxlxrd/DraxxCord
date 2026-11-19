/*
 * DraxxCord limited-scope port of AutoNickname.
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Does not modify other users. Original full source is in SOURCE_REVIEW_ONLY.
 */
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    active: { type: OptionType.BOOLEAN, description: "Allow automatic changes to MY nickname (opt-in)", default: false },
    guildId: { type: OptionType.STRING, description: "Target server ID", default: "" },
    nickname: { type: OptionType.STRING, description: "My desired nickname on that server", default: "" }
});
let lastAttempt = 0;
async function setOwnNickname(guildId: string, nick: string) {
    try { await RestAPI.patch({ url: `/users/@me/guilds/${guildId}/profile`, body: { nick } }); }
    catch (e) {
        try { await RestAPI.patch({ url: `/guilds/${guildId}/members/@me`, body: { nick } }); }
        catch (inner) { console.warn("[DraxxCord AutoNickname] Could not update own nickname:", inner); }
    }
}
export default definePlugin({
    name: "DraxxCord AutoNickname",
    description: "Opt-in: keep YOUR own nickname fixed in one server. Simplified port; no other-user nicknames.",
    authors: [{ name: "x2b", id: 996137713432530976n }],
    settings,
    flux: {
        GUILD_MEMBER_UPDATE(event: any) {
            if (!settings.store.active || !settings.store.guildId || !settings.store.nickname.trim()) return;
            const guildId = event.guildId ?? event.guild_id;
            const userId = event.user?.id ?? event.member?.user?.id ?? event.userId;
            const nickname = event.nick ?? event.member?.nick;
            if (guildId !== settings.store.guildId.trim() || userId !== UserStore.getCurrentUser()?.id) return;
            if (nickname === settings.store.nickname) return;
            const now = Date.now();
            if (now - lastAttempt < 30_000) return;
            lastAttempt = now;
            void setOwnNickname(guildId, settings.store.nickname);
        }
    },
    stop() { lastAttempt = 0; }
});
