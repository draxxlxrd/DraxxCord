import { setOriginalFakeDeafen, stopOriginalFakeDeafen } from "./fakeDeafenBridge";
/*
 * DraxxCord FakeVoice v11 - panel integration of a user-supplied Vencord implementation.
 * Based on Vencord-FakeDeafen (hyyven; credits yofukashino and SiriusBYT).
 * Includes original Vencord / plugin authorship attribution; no tokens or login access.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Only outgoing voice state is modified. Discord's server may reject or overwrite it.
 */

import { findByPropsLazy, findStoreLazy } from "@webpack";
import { ChannelStore, MediaEngineStore, SelectedChannelStore, UserStore, VoiceStateStore } from "@webpack/common";

type VoicePacket = {
    guild_id?: string | null;
    channel_id?: string | null;
    self_mute?: boolean;
    self_deaf?: boolean;
    self_video?: boolean;
    flags?: number;
    [key: string]: unknown;
};

type Socket = {
    send: (op: number, packet: VoicePacket, ...args: any[]) => unknown;
};
type SocketHolder = { getSocket?: () => Socket | null | undefined };

// The user-supplied plugin uses findByProps("getSocket") and socket.send(4, payload).
// Resolve lazily to handle Discord startup / gateway reconnects.
const SocketModule = findByPropsLazy("getSocket") as SocketHolder;
const GatewayStore = findStoreLazy("GatewayConnectionStore") as SocketHolder;

class DraxxFakeVoiceManager {
    private muted = false;
    private deafened = false;
    private video = false;
    private screen = false;
    private active = false;
    private socket: Socket | null = null;
    private originalSend: Socket["send"] | null = null;
    private wrappedSend: Socket["send"] | null = null;
    private timer: number | null = null;
    private lastChannel: string | null = null;
    private lastNatural: VoicePacket | null = null;
    private isManualSend = false;
    private packetsSeen = 0;
    private latest = "Not running";
    private listeners = new Set<() => void>();

    get fakeMuteEnabled() { return this.muted; }
    get fakeDeafenEnabled() { return this.deafened; }
    get fakeVideoEnabled() { return this.video; }
    get fakeScreenEnabled() { return this.screen; }
    get gatewayHookObserved() { return this.packetsSeen > 0; }
    get voiceStatus() {
        return `${this.latest}; outbound op4 ${this.packetsSeen}; ${this.socket ? "socket found" : "no socket"}. Server result unverified.`;
    }

    subscribe(fn: () => void) {
        this.listeners.add(fn);
        return () => { this.listeners.delete(fn); };
    }
    private notify() {
        for (const fn of this.listeners) {
            try { fn(); } catch { /* visual callback should not stop gateway */ }
        }
    }
    private getChannelId(): string | null {
        try {
            const id = UserStore.getCurrentUser()?.id;
            const state = id && VoiceStateStore.getVoiceStateForUser?.(id);
            if (state?.channelId) return state.channelId;
        } catch { /* store may be unavailable during startup */ }
        try { return SelectedChannelStore.getVoiceChannelId?.() || null; }
        catch { return null; }
    }
    private getSocket(): Socket | null {
        for (const store of [SocketModule, GatewayStore]) {
            try {
                const candidate = store?.getSocket?.();
                if (candidate && typeof candidate.send === "function") return candidate;
            } catch { /* gateway not ready */ }
        }
        return null;
    }
    private detach() {
        // Do not clobber wrappers installed by other plugins after ours.
        if (this.socket && this.wrappedSend && this.originalSend && this.socket.send === this.wrappedSend) {
            this.socket.send = this.originalSend;
        }
        this.socket = null;
        this.originalSend = null;
        this.wrappedSend = null;
    }
    private hookSocket(): boolean {
        const socket = this.getSocket();
        if (!socket) {
            this.latest = "Discord gateway socket unavailable";
            this.notify();
            return false;
        }
        if (socket === this.socket && socket.send === this.wrappedSend) return true;
        this.detach();
        const original = socket.send;
        const manager = this;
        const wrapper: Socket["send"] = function (this: Socket, op, packet, ...args) {
            if (op !== 4 || !packet || typeof packet !== "object") {
                return original.call(this, op, packet, ...args);
            }
            // Clone the outgoing voice packet instead of mutating Discord's own object.
            const next = { ...packet };
            if (!manager.isManualSend) manager.lastNatural = { ...next };
            if (next.channel_id != null && manager.active) {
                if (manager.muted) { next.self_mute = true; }
                if (manager.video) next.self_video = true; // Experimental UI mode.
            }
            manager.packetsSeen++;
            manager.latest = `Sent op4 (self_mute=${String(next.self_mute)}, self_deaf=${String(next.self_deaf)})`;
            manager.notify();
            return original.call(this, op, next, ...args);
        };
        try {
            socket.send = wrapper;
            if (socket.send !== wrapper) throw new Error("Socket send method not writable");
            this.socket = socket;
            this.originalSend = original;
            this.wrappedSend = wrapper;
            this.latest = "Gateway opcode-4 hook installed";
            this.notify();
            return true;
        } catch (err) {
            this.latest = "Cannot install gateway opcode-4 hook";
            console.warn("[DraxxCord FakeVoice v11]", err);
            this.notify();
            return false;
        }
    }
    private sendCurrent(): boolean {
        const channelId = this.getChannelId();
        if (!channelId) {
            this.latest = "No voice channel; armed for next join";
            this.notify();
            return true;
        }
        if (!this.hookSocket() || !this.socket) return false;
        const channel = ChannelStore.getChannel(channelId);
        const localMute = Boolean(MediaEngineStore.isMute?.());
        const localDeaf = Boolean(MediaEngineStore.isDeaf?.());
        const packet: VoicePacket = {
            guild_id: channel?.guild_id ?? null,
            channel_id: channelId,
            self_mute: localMute || localDeaf,
            self_deaf: localDeaf,
            self_video: this.lastNatural?.self_video ?? Boolean(MediaEngineStore.isVideoEnabled?.()),
            flags: this.lastNatural?.flags ?? 0
        };
        try {
            // Use the same opcode-4 sender as the user-provided Vencord plugin.
            // The installed hook applies fake flags and preserves them on later normal updates.
            this.isManualSend = true;
            this.socket.send(4, packet);
            return true;
        } catch (err) {
            this.latest = "Opcode-4 send failed; check developer console";
            console.warn("[DraxxCord FakeVoice v11]", err);
            this.notify();
            return false;
        } finally {
            this.isManualSend = false;
        }
    }
    private toggle(kind: "mute" | "deaf" | "video" | "screen", force?: boolean): boolean {
        const previous = kind === "mute" ? this.muted : kind === "deaf" ? this.deafened : kind === "video" ? this.video : this.screen;
        const next = typeof force === "boolean" ? force : !previous;
        if (next === previous) return previous;
        if (kind === "mute") this.muted = next;
        if (kind === "deaf") this.deafened = next;
        if (kind === "video") this.video = next;
        if (kind === "screen") this.screen = next;
        // Index.tsx from the existing panel may restore toggles before calling start().
        // Hook lazily here so the first button press always attempts a real send.
        const ok = this.sendCurrent();
        if (!ok) {
            if (kind === "mute") this.muted = previous;
            if (kind === "deaf") this.deafened = previous;
            if (kind === "video") this.video = previous;
            if (kind === "screen") this.screen = previous;
        }
        this.notify();
        return kind === "mute" ? this.muted : kind === "deaf" ? this.deafened : kind === "video" ? this.video : this.screen;
    }

    toggleFakeMute(force?: boolean) { return this.toggle("mute", force); }
    toggleFakeDeafen(force?: boolean) {
        const desired = typeof force === "boolean" ? force : !this.deafened;
        if (desired === this.deafened) return this.deafened;
        const previous = this.deafened;
        const before = this.packetsSeen;
        this.deafened = desired;
        try {
            setOriginalFakeDeafen(desired);
            if (this.packetsSeen === before) {
                throw new Error("Upstream toggle ran, but no outgoing opcode-4 was seen");
            }
            this.latest = "Original FakeDeafen: op4 observed; checking received voice state...";
            // Diagnostic only: does not affect Gateway traffic or upstream FakeDeafen.
            const requestedDeaf = desired;
            window.setTimeout(() => {
                if (this.deafened !== requestedDeaf) return;
                try {
                    const myId = UserStore.getCurrentUser()?.id;
                    const remoteState = myId ? VoiceStateStore.getVoiceStateForUser?.(myId) : undefined;
                    if (!remoteState) {
                        this.latest = "VoiceStateStore: no current voice state (check channel/connection)";
                    } else {
                        const receivedDeaf = Boolean(remoteState.selfDeaf);
                        const receivedMute = Boolean(remoteState.selfMute);
                        const match = receivedDeaf === requestedDeaf;
                        this.latest = `VoiceStateStore: deaf=${receivedDeaf} mute=${receivedMute}; requested deaf=${requestedDeaf}; ${match ? "MATCH" : "MISMATCH"}. Other-client result unverified`;
                    }
                } catch (error) {
                    this.latest = `VoiceStateStore check unavailable: ${String(error)}`;
                }
                this.notify();
            }, 1700);
        } catch (error) {
            this.deafened = previous;
            this.latest = `Original FakeDeafen failed: ${String(error)}`;
            console.warn("[DraxxCord] Original FakeDeafen bridge", error);
            try { stopOriginalFakeDeafen(); } catch { /* preserve primary error */ }
        }
        this.notify();
        return this.deafened;
    }
    toggleFakeVideo(force?: boolean) { return this.toggle("video", force); }
    toggleFakeScreen(force?: boolean) { return this.toggle("screen", force); }
    shouldApplyFakeState = (real: boolean | undefined, type: "mute" | "deaf" | "video" | "stream") => {
        if (type === "mute") return Boolean(real || this.muted || this.deafened);
        if (type === "deaf") return Boolean(real || this.deafened);
        if (type === "video") return Boolean(real || this.video);
        if (type === "stream") return Boolean(real || this.screen);
        return Boolean(real);
    };

    resetState() {
        try { stopOriginalFakeDeafen(); }
        catch (err) { console.warn("[DraxxCord] FakeDeafen upstream stop", err); }
        this.muted = this.deafened = this.video = this.screen = false;
        if (this.active) this.sendCurrent();
        this.notify();
    }
    start() {
        if (this.active) return;
        this.active = true;
        this.hookSocket();
        if (this.muted || this.deafened || this.video) this.sendCurrent();
        this.timer = window.setInterval(() => {
            if (!this.active) return;
            const prior = this.socket;
            const channel = this.getChannelId();
            const changed = channel !== this.lastChannel;
            this.lastChannel = channel;
            const hooked = this.hookSocket();
            if (hooked && (changed || this.socket !== prior) && (this.muted || this.deafened || this.video)) {
                this.sendCurrent();
            }
        }, 1500);
        this.notify();
    }
    stop() {
        if (!this.active) return;
        this.resetState();
        this.active = false;
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
        this.detach();
        this.latest = "Stopped; local state restored";
        this.notify();
    }
}

export const FakeState = new DraxxFakeVoiceManager();
