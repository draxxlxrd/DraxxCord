/*
 * DraxxCord FollowGod - opt-in activity/voice notification, with optional own voice follow.
 * Based on user-provided b4lCord FollowGod (GPL-3.0-or-later).
 * Only uses Discord presence/voice events already visible to the local client.
 * Does not reveal invisible or hidden activities and never moves other members.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import definePlugin, { OptionType } from "@utils/types";
import { definePluginSettings } from "@api/Settings";
import { findStoreLazy, findByPropsLazy } from "@webpack";
import { ChannelStore, Menu, SelectedChannelStore, UserStore, showToast } from "@webpack/common";
const VoiceStateStore = findStoreLazy("VoiceStateStore") as any;
const VoiceActions = findByPropsLazy("selectVoiceChannel", "disconnect") as any;
const settings = definePluginSettings({
    enabled: { type: OptionType.BOOLEAN, default: false, description: "Enable visible presence and voice notifications for explicitly watched users" },
    watchedUserIds: { type: OptionType.STRING, default: "[]", description: "JSON list of watched user IDs; use right-click on a member to edit" },
    notifyVoice: { type: OptionType.BOOLEAN, default: true, description: "Notify when selected users enter/leave visible voice channels" },
    notifyActivity: { type: OptionType.BOOLEAN, default: true, description: "Notify on Discord-visible game/music/stream activity changes" },
    autoJoinVoice: { type: OptionType.BOOLEAN, default: false, description: "Join visible watched-member voice (changes YOUR channel only, off by default)" },
    onlyIfAlreadyVoice: { type: OptionType.BOOLEAN, default: true, description: "Auto-join only if you are already in a voice channel" }
});
const names: Record<number, string> = { 0: "Playing", 1: "Streaming", 2: "Listening", 3: "Watching", 5: "Competing" };
const lastPresence = new Map<string, string>();
const lastVoice = new Map<string, string | null>();
let lastNotice = 0;
let lastJoin = 0;
function getIds(): string[] {
    try {
        const ids = JSON.parse(settings.store.watchedUserIds);
        return Array.isArray(ids) ? ids.filter((id: any) => typeof id === "string" && /^\d{15,22}$/.test(id)).slice(0, 20) : [];
    } catch { return []; }
}
function notice(uid: string, text: string) {
    const now = Date.now(); if (now - lastNotice < 1200) return;
    lastNotice = now;
    const user: any = UserStore.getUser(uid);
    showToast(`DraxxCord FollowGod · ${user?.globalName || user?.username || uid}: ${text}`);
}
function toggle(uid: string) {
    const ids = getIds();
    const next = ids.includes(uid) ? ids.filter(x => x !== uid) : [...ids, uid].slice(0, 20);
    settings.store.watchedUserIds = JSON.stringify(next);
    lastPresence.delete(uid); lastVoice.delete(uid);
    showToast(`DraxxCord FollowGod: ${next.includes(uid) ? "watching visible activity" : "unwatched"} (${next.length} users)`);
}
function maybeJoin(cid: string | null) {
    if (!cid || !settings.store.autoJoinVoice) return;
    const now = Date.now(); if (now - lastJoin < 15000) return;
    const ownId = UserStore.getCurrentUser()?.id;
    const own = ownId ? VoiceStateStore?.getVoiceStateForUser?.(ownId) : null;
    if (settings.store.onlyIfAlreadyVoice && !own?.channelId) return;
    if (cid === SelectedChannelStore.getVoiceChannelId()) return;
    if (!ChannelStore.getChannel(cid) || !VoiceActions?.selectVoiceChannel) return;
    lastJoin = now;
    try { VoiceActions.selectVoiceChannel(cid); } catch (err) { console.warn("[DraxxCord FollowGod] join failed", err); }
}
export default definePlugin({
    name: "DraxxCord FollowGod",
    description: "Opt-in notifications for Discord-visible activity and voice, plus optional own voice follow. No hidden activity tracking.",
    authors: [{ name: "DraxxCord compatibility port (b4lCord reference)", id: 0n }],
    settings,
    contextMenus: {
        "user-context"(children: any[], props: any) {
            const uid: string | undefined = props?.user?.id;
            if (!uid || uid === UserStore.getCurrentUser()?.id) return;
            children.push(<Menu.MenuItem id="draxxcord-followgod" label={getIds().includes(uid) ? "DraxxCord: Unwatch FollowGod" : "DraxxCord: Watch Visible Activity"}
                action={() => toggle(uid)} />);
        }
    },
    flux: {
        PRESENCE_UPDATES({ updates }: { updates: any[] }) {
            if (!settings.store.enabled || !settings.store.notifyActivity || !Array.isArray(updates)) return;
            const watched = new Set(getIds());
            for (const u of updates) {
                const uid: string | undefined = u?.user?.id;
                if (!uid || !watched.has(uid)) continue;
                const activities = (Array.isArray(u.activities) ? u.activities : []).filter((a: any) => names[a?.type] && a?.name);
                const key = activities.map((a: any) => `${a.type}:${a.name}`).sort().join("|");
                const old = lastPresence.get(uid);
                lastPresence.set(uid, key);
                if (old === undefined || old === key) continue; // No notice on initial data sync
                notice(uid, key ? activities.map((a: any) => `${names[a.type]} ${a.name}`).join("; ") : "activity ended");
            }
        },
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: any[] }) {
            if (!settings.store.enabled || !Array.isArray(voiceStates)) return;
            const watched = new Set(getIds());
            for (const vs of voiceStates) {
                const uid = vs?.userId;
                if (!uid || !watched.has(uid)) continue;
                const cid: string | null = vs.channelId ?? null;
                const prev = lastVoice.get(uid);
                lastVoice.set(uid, cid);
                if (prev === undefined || prev === cid) continue;
                if (settings.store.notifyVoice) notice(uid, cid ? "joined/moved voice channel" : "left voice channel");
                if (cid) maybeJoin(cid);
            }
        }
    },
    start() { lastPresence.clear(); lastVoice.clear(); lastJoin = 0; },
    stop() { lastPresence.clear(); lastVoice.clear(); }
});
