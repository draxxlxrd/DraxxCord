/*
 * DraxxCord Custom Stream Image — port of CustomStreamPreview by LOSTSTR (2026).
 * SPDX-License-Identifier: GPL-3.0-or-later
 * This plugin uses only Discord's internal RestAPI (no direct token access).
 */

import * as DataStore from "@api/DataStore";
import { Logger } from "@utils/Logger";
import { ApplicationStreamingStore, ChannelStore, RestAPI, SelectedChannelStore, showToast, UserStore } from "@webpack/common";

const logger = new Logger("DraxxCordStreamImage");
const DATA_KEY = "DraxxCordCustomStreamImage_image";
const LEGACY_KEY = "CustomStreamPreview_image";
const INTERVAL_MS = 300_000;
const MIN_GAP_MS = 70_000;
const START_DELAY_MS = 2_000;

let scheduled: ReturnType<typeof setTimeout> | null = null;
let recurring: ReturnType<typeof setInterval> | null = null;
let lastUploadAt = 0;
let currentKey: string | null = null;

function toast(text: string, ok = true) {
    showToast({ text, variant: ok ? "success" : "critical" });
}

export const isStreaming = (): boolean =>
    Boolean(ApplicationStreamingStore.getCurrentUserActiveStream());

export async function getSavedPreview(): Promise<string | null> {
    // Preserve saved images from the original port if a user upgrades.
    const own = await DataStore.get<string>(DATA_KEY);
    if (own !== null && own !== undefined) return own || null;
    return (await DataStore.get<string>(LEGACY_KEY)) || null;
}

export const savePreview = (image: string) => DataStore.set(DATA_KEY, image);
export const deletePreview = () => DataStore.set(DATA_KEY, "");

export function belongsToCurrentUser(streamKey: string): boolean {
    const id = UserStore.getCurrentUser()?.id;
    if (!id) return false;
    const parts = streamKey.split(":");
    return (parts[0] === "guild" && parts.length === 4 && parts[3] === id)
        || (parts[0] === "call" && parts.length === 3 && parts[2] === id);
}

function lookupStreamKey(): string | null {
    const active = ApplicationStreamingStore.getCurrentUserActiveStream() as unknown as { streamKey?: string; stream_key?: string; } | null;
    const fromStore = active?.streamKey || active?.stream_key;
    if (fromStore && belongsToCurrentUser(fromStore)) return fromStore;

    const channelId = SelectedChannelStore.getVoiceChannelId();
    const id = UserStore.getCurrentUser()?.id;
    if (!channelId || !id) return null;
    const channel = ChannelStore.getChannel(channelId);
    if (!channel) return null;
    if (channel.type === 1 || channel.type === 3) return `call:${channelId}:${id}`;
    if (channel.type === 2 || channel.type === 13) {
        const guildId = channel.getGuildId?.();
        if (guildId) return `guild:${guildId}:${channelId}:${id}`;
    }
    return null;
}

async function uploadOnce(image: string, key: string) {
    if (!isStreaming()) {
        stopSendingPreview();
        return;
    }
    try {
        // Stream keys contain colons; they are part of the documented endpoint path.
        // RestAPI provides the Discord session headers internally.
        await RestAPI.post({ url: `/streams/${key}/preview`, body: { thumbnail: image } });
        lastUploadAt = Date.now();
        logger.info("Custom stream thumbnail accepted by Discord.");
    } catch (error) {
        logger.error("Discord rejected the stream preview upload:", error);
        toast("DraxxCord: Discord did not accept the preview. Check the console.", false);
    }
}

export function startSendingPreview(image: string, streamKey?: string): boolean {
    const key = streamKey || currentKey || lookupStreamKey();
    if (!key || !belongsToCurrentUser(key)) return false;
    stopSendingPreview();
    currentKey = key;

    const delay = Math.max(START_DELAY_MS, lastUploadAt + MIN_GAP_MS - Date.now());
    scheduled = setTimeout(() => {
        scheduled = null;
        if (!isStreaming()) return;
        void uploadOnce(image, key);
        recurring = setInterval(() => void uploadOnce(image, key), INTERVAL_MS);
    }, delay);
    return true;
}

export function stopSendingPreview(): void {
    if (scheduled !== null) clearTimeout(scheduled);
    if (recurring !== null) clearInterval(recurring);
    scheduled = null;
    recurring = null;
}

export function clearActiveStream() {
    stopSendingPreview();
    currentKey = null;
}

export const isSendingPreview = () => scheduled !== null || recurring !== null;

/** Convert any locally selected image to a 454x256 JPEG thumbnail (16:9). */
export function imageFileToPreview(file: File): Promise<string> {
    if (!file.type.startsWith("image/")) return Promise.reject(new Error("Select an image file."));
    if (file.size > 20 * 1024 * 1024) return Promise.reject(new Error("Choose an image under 20 MB."));
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        const image = new Image();
        reader.onerror = () => reject(new Error("Could not read the image."));
        image.onerror = () => reject(new Error("Invalid image file."));
        reader.onload = () => { image.src = String(reader.result ?? ""); };
        image.onload = () => {
            const width = 454;
            const height = 256;
            const target = width / height;
            const original = image.width / image.height;
            const srcWidth = original > target ? image.height * target : image.width;
            const srcHeight = original > target ? image.height : image.width / target;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) { reject(new Error("Canvas unavailable.")); return; }
            ctx.drawImage(image, (image.width - srcWidth) / 2, (image.height - srcHeight) / 2, srcWidth, srcHeight, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.18));
        };
        reader.readAsDataURL(file);
    });
}
