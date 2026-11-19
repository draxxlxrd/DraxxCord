/*
 * Vencord-compatible DraxxCord MetadataScanner standalone port.
 * Reconstructed from the MetadataViewer/index.tsx entry point recovered
 * from b4lCord, with missing components supplied by this port.
 * Original contributor: SirPhantom89 (1464279455844274188).
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Menu, MessageStore, openModal, React, UploadHandler } from "@webpack/common";
import { ScannerModal } from "./modal";
import { stripImageMetadata } from "./scanner";

const settings = definePluginSettings({
    autoStripMetadata: {
        type: OptionType.BOOLEAN,
        description: "Remove selected EXIF/text metadata from PNG/JPEG images passed through promptToUpload (OFF by default). Not a complete privacy guarantee.",
        default: false
    }
});

type Attachment = { url?: string; proxy_url?: string; filename?: string; content_type?: string };

type MenuProps = {
    src?: string; itemSrc?: string; itemHref?: string; attachmentUrl?: string;
    attachment?: Attachment;
    mediaItem?: { url?: string; proxyUrl?: string; filename?: string; name?: string };
    message?: { attachments?: Attachment[]; embeds?: any[]; messageSnapshots?: any[] };
    channelId?: string; messageId?: string;
};

function resolve(props: MenuProps | undefined): { url: string; name: string } | null {
    if (!props) return null;
    let message = props.message;
    if (!message && props.channelId && props.messageId) {
        try { message = MessageStore.getMessage(props.channelId, props.messageId) as any; } catch { /* optional */ }
    }
    const attachments = [
        props.attachment,
        ...(message?.attachments ?? []),
        ...((message?.messageSnapshots ?? []).flatMap(x => x?.message?.attachments ?? []))
    ].filter(Boolean) as Attachment[];
    const candidate = props.mediaItem?.url ?? props.mediaItem?.proxyUrl ?? props.attachmentUrl ?? props.src ?? props.itemSrc ?? props.itemHref;
    const match = attachments.find(a => a.url === candidate || a.proxy_url === candidate) ?? attachments[0];
    let url = match?.url ?? match?.proxy_url ?? candidate;
    if (!url && message?.embeds) {
        for (const e of message.embeds) {
            url = e?.image?.url || e?.thumbnail?.url || e?.video?.url;
            if (url) break;
        }
    }
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return null;
        const name = match?.filename ?? props.mediaItem?.filename ?? props.mediaItem?.name ?? decodeURIComponent(parsed.pathname.split("/").pop() || "attachment");
        return { url, name };
    } catch { return null; }
}

function addMenu(children: any[], props: MenuProps) {
    if (!Array.isArray(children)) return;
    if (children.some((x: any) => x?.props?.id === "draxx-metadata-scan")) return;
    const media = resolve(props);
    if (!media) return;
    children.push(<Menu.MenuItem
        id="draxx-metadata-scan"
        label="Scan Image Metadata (DraxxCord)"
        action={() => openModal(modalProps => <ScannerModal rootProps={modalProps} url={media.url} name={media.name} />)}
    />);
}

let originalPrompt: typeof UploadHandler.promptToUpload | undefined;
let wrappedPrompt: typeof UploadHandler.promptToUpload | undefined;

export default definePlugin({
    name: "DraxxCordMetadataScanner",
    description: "Inspect image metadata (EXIF, GPS, PNG text, WebP) from right-click menus. Optional limited upload cleanup.",
    authors: [{ name: "SirPhantom89", id: 1464279455844274188n }],
    settings,
    contextMenus: {
        "message": addMenu,
        "image-context": addMenu,
        "attachment-link-context": addMenu
    },
    start() {
        try {
            const current = UploadHandler.promptToUpload;
            if (typeof current !== "function") return;
            originalPrompt = current;
            wrappedPrompt = (async (files: File[], channel: any, draftType: any) => {
                const base = originalPrompt!;
                if (!settings.store.autoStripMetadata || !Array.isArray(files)) return base(files, channel, draftType);
                try {
                    const sanitized = await Promise.all(files.map(file => {
                        if (!(file instanceof File) || !/\.(png|jpe?g)$/i.test(file.name)) return file;
                        return stripImageMetadata(file);
                    }));
                    return base(sanitized, channel, draftType);
                } catch (e) {
                    console.warn("[DraxxCordMetadataScanner] Metadata cleanup failed; original files will be uploaded", e);
                    return base(files, channel, draftType);
                }
            }) as typeof UploadHandler.promptToUpload;
            UploadHandler.promptToUpload = wrappedPrompt;
        } catch (e) { console.warn("[DraxxCordMetadataScanner] Upload hook unavailable", e); }
    },
    stop() {
        if (originalPrompt && wrappedPrompt && UploadHandler.promptToUpload === wrappedPrompt) UploadHandler.promptToUpload = originalPrompt;
        originalPrompt = wrappedPrompt = undefined;
    }
});
