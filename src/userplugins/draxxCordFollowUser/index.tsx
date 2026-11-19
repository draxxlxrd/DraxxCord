/*
 * DraxxCord compatibility reimplementation of FollowUser.
 * Reference: user-supplied b4lCord FollowUser (GPL-3.0-or-later).
 * Original plugin credits preserved in README. This port moves only YOUR voice session.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy, findStoreLazy } from "@webpack";
import { Menu, UserStore, ChannelStore, showToast } from "@webpack/common";

const VoiceStateStore = findStoreLazy("VoiceStateStore") as any;
const VoiceActions = findByPropsLazy("selectVoiceChannel", "disconnect") as any;
const settings = definePluginSettings({
    enabled: { type: OptionType.BOOLEAN, description: "Enable following after selecting a user (opt-in)", default: false },
    userId: { type: OptionType.STRING, description: "User ID to follow; choose using right-click > DraxxCord Follow User", default: "" },
    onlyWhenInVoice: { type: OptionType.BOOLEAN, description: "Only move if you are already in a voice channel", default: true },
    pauseWhileStreaming: { type: OptionType.BOOLEAN, description: "Do not switch while you are screen sharing or using camera", default: true },
    leaveWhenUserLeaves: { type: OptionType.BOOLEAN, description: "Disconnect when followed user leaves", default: false }
});
let lastChannel: string | null = null;
let lastNotice = 0;
function notify(message: string) {
    const now = Date.now();
    if (now - lastNotice > 2000) { showToast(message); lastNotice = now; }
}
function voiceState(uid: string | undefined) {
    try { return uid ? VoiceStateStore?.getVoiceStateForUser?.(uid) : null; } catch { return null; }
}
function moveTo(channelId: string | null) {
    try {
        if (!settings.store.enabled || !settings.store.userId) return;
        const myId = UserStore.getCurrentUser()?.id;
        const mine = voiceState(myId);
        if (!mine && settings.store.onlyWhenInVoice) return;
        if (settings.store.pauseWhileStreaming && (mine?.selfStream || mine?.selfVideo)) return;
        if (channelId === mine?.channelId) return;
        if (!channelId) {
            if (settings.store.leaveWhenUserLeaves && mine?.channelId) VoiceActions?.disconnect?.();
            return;
        }
        const channel = ChannelStore.getChannel(channelId);
        if (!channel || !VoiceActions?.selectVoiceChannel) return;
        VoiceActions.selectVoiceChannel(channelId);
        notify("DraxxCord: joined followed user's voice channel");
    } catch (e) { console.warn("[DraxxCord FollowUser] Voice change failed", e); }
}
export default definePlugin({
    name: "DraxxCord FollowUser",
    description: "Opt-in voice follow: you join a selected user's voice channel. Does not move others.",
    authors: [{ name: "TheArmagan (original FollowUser)", id: 0n }],
    settings,
    contextMenus: {
        "user-context"(children: any[], props: any) {
            const userId = props?.user?.id;
            if (!userId || userId === UserStore.getCurrentUser()?.id) return;
            children.push(<Menu.MenuItem id="draxxcord-follow-user" label={settings.store.enabled && settings.store.userId === userId ? "DraxxCord: Stop Following" : "DraxxCord: Follow User"} action={() => {
                if (settings.store.enabled && settings.store.userId === userId) {
                    settings.store.enabled = false; settings.store.userId = ""; lastChannel = null; notify("DraxxCord: stopped following");
                } else {
                    settings.store.userId = userId; settings.store.enabled = true; lastChannel = null; notify("DraxxCord: following voice changes (your session only)");
                }
            }}/>)
        }
    },
    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[]; }) {
            if (!settings.store.enabled || !settings.store.userId || !Array.isArray(voiceStates)) return;
            for (const state of voiceStates) {
                if (state.userId !== settings.store.userId) continue;
                const next: string | null = state.channelId ?? null;
                if (next === lastChannel) return;
                lastChannel = next;
                moveTo(next);
                return;
            }
        }
    },
    start() { lastChannel = voiceState(settings.store.userId)?.channelId ?? null; },
    stop() { lastChannel = null; }
});
