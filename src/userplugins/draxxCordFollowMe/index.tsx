/*
 * DraxxCord FollowMe - opt-in one-target voice following.
 * Port of user-provided b4lCord FollowMe concept (GPL-3.0-or-later).
 * Moves only the nominated consenting member; requires Move Members permission.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findStoreLazy } from "@webpack";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, RestAPI, UserStore, showToast } from "@webpack/common";

const VoiceStateStore = findStoreLazy("VoiceStateStore") as any;
const settings = definePluginSettings({
    enabled: { type: OptionType.BOOLEAN, default: false, description: "Allow voice follows; requires choosing a target and their consent" },
    consentConfirmed: { type: OptionType.BOOLEAN, default: false, description: "I have the selected member's consent to move them between channels" },
    cooldownSeconds: { type: OptionType.NUMBER, default: 15, description: "Minimum seconds between moving the target (minimum 10)" },
    notifyMoves: { type: OptionType.BOOLEAN, default: true, description: "Show result notifications" }
});
let targetId: string | null = null;
let lastMovedChannel: string | null = null;
let lastMove = 0;
let busy = false;
function notice(msg: string) { if (settings.store.notifyMoves) showToast(msg); }
function stateOf(id: string) { try { return VoiceStateStore?.getVoiceStateForUser?.(id); } catch { return null; } }
function stopFollowing() { targetId = null; lastMovedChannel = null; notice("DraxxCord FollowMe: stopped"); }
async function moveToMyVoice(guildId: string, channelId: string) {
    if (!targetId || !settings.store.enabled || !settings.store.consentConfirmed || busy) return;
    const me: any = UserStore.getCurrentUser();
    if (!me) return;
    const mine: any = stateOf(me.id);
    const them: any = stateOf(targetId);
    // Only act after my own channel switch, and only within the same guild.
    if (!mine || mine.channelId !== channelId || mine.guildId !== guildId) return;
    if (!them?.channelId || them.guildId !== guildId || them.channelId === channelId) return;
    const ch: any = ChannelStore.getChannel(channelId);
    if (!ch || !PermissionStore.can(PermissionsBits.MOVE_MEMBERS, ch)) { notice("DraxxCord FollowMe: Move Members permission required"); return; }
    if (channelId === lastMovedChannel) return;
    const now = Date.now();
    if (now - lastMove < Math.max(10, Number(settings.store.cooldownSeconds) || 15) * 1000) return;
    busy = true;
    lastMove = now;
    try {
        // Discord guild member move API: only authenticated moderators with permission can do this.
        await RestAPI.patch({ url: `/guilds/${guildId}/members/${targetId}`, body: { channel_id: channelId } });
        lastMovedChannel = channelId;
        notice("DraxxCord FollowMe: moved consenting member to your channel");
    } catch (error) { console.warn("[DraxxCord FollowMe] move failed", error); notice("DraxxCord FollowMe: move failed or permission denied"); }
    finally { busy = false; }
}
export default definePlugin({
    name: "DraxxCord FollowMe",
    description: "With permission and the member's consent, moves one selected member when you change voice channel. Off by default.",
    authors: [{ name: "DraxxCord compatibility port (b4lCord reference)", id: 0n }],
    settings,
    contextMenus: {
        "user-context"(children: any[], props: any) {
            const uid: string | undefined = props?.user?.id;
            if (!uid || uid === UserStore.getCurrentUser()?.id) return;
            children.push(<Menu.MenuItem id="draxxcord-followme" label={targetId === uid ? "DraxxCord: Stop FollowMe" : "DraxxCord: Select FollowMe Target"}
                action={() => {
                    if (targetId === uid) { stopFollowing(); return; }
                    targetId = uid; lastMovedChannel = null;
                    notice("DraxxCord FollowMe: target selected. Enable and confirm consent in plugin Settings.");
                }} />);
        }
    },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[] }) {
            if (!targetId || !settings.store.enabled || !settings.store.consentConfirmed || !Array.isArray(voiceStates)) return;
            const myId = UserStore.getCurrentUser()?.id;
            for (const s of voiceStates) {
                if (s.userId !== myId || !s.channelId || !s.guildId) continue;
                void moveToMyVoice(s.guildId, s.channelId);
            }
        }
    },
    start() { targetId = null; lastMovedChannel = null; lastMove = 0; },
    stop() { targetId = null; lastMovedChannel = null; busy = false; }
});
