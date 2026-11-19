/*
 * DraxxCord Custom Stream Image — adapted from CustomStreamPreview by LOSTSTR.
 * Copyright (c) 2026 LOSTSTR; SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { closeModal, ModalCloseButton as RawClose, ModalContent as RawContent, ModalFooter as RawFooter, ModalHeader as RawHeader, ModalRoot as RawRoot, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { ApplicationStreamingStore, React, createRoot, showToast, useEffect, useState, useStateFromStores, UserStore } from "@webpack/common";

import type { StreamCreateEvent, StreamDeleteEvent } from "./types";
import { mountAccountButton } from "./accountPanelMount";
import { belongsToCurrentUser, clearActiveStream, deletePreview, getSavedPreview, imageFileToPreview, isSendingPreview, isStreaming, savePreview, startSendingPreview, stopSendingPreview } from "./utilities";

// The old Modal* exports are still available at runtime in current Vencord,
// but their exposed TypeScript types are deliberately deprecated.
const ModalRoot = RawRoot as unknown as React.ComponentType<any>;
const ModalHeader = RawHeader as unknown as React.ComponentType<any>;
const ModalContent = RawContent as unknown as React.ComponentType<any>;
const ModalFooter = RawFooter as unknown as React.ComponentType<any>;
const ModalCloseButton = RawClose as unknown as React.ComponentType<any>;

const msg = (text: string, ok = true) => showToast({ text, variant: ok ? "success" : "critical" });

function ImageIcon({ className }: { className?: string; }) {
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="8.5" cy="9" r="1.5" fill="currentColor" />
        <path d="m5 18 5-5 3 3 3-4 3 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>;
}

function ImageModal({ modalProps, close }: { modalProps: any; close(): void; }) {
    const [preview, setPreview] = useState<string | null>(null);
    const [sending, setSending] = useState(isSendingPreview());
    const [busy, setBusy] = useState(false);
    const active = useStateFromStores([ApplicationStreamingStore], isStreaming);

    useEffect(() => {
        let open = true;
        void getSavedPreview().then(image => { if (open) setPreview(image); }).catch(() => msg("Could not load saved image", false));
        return () => { open = false; };
    }, []);

    const selectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        if (!file) return;
        setBusy(true);
        try {
            const image = await imageFileToPreview(file);
            await savePreview(image);
            setPreview(image);
            if (active) {
                const started = startSendingPreview(image);
                setSending(started);
                msg(started ? "Image saved; preview upload scheduled." : "Saved, but Discord stream could not be located.", started);
            } else {
                msg("Image saved. Start sharing your screen to use it.");
            }
        } catch (error) {
            msg(error instanceof Error ? error.message : "Unable to process image", false);
        } finally {
            setBusy(false);
            event.currentTarget.value = "";
        }
    };

    const removeImage = async () => {
        try {
            stopSendingPreview();
            await deletePreview();
            setPreview(null);
            setSending(false);
            msg("DraxxCord image cleared.");
        } catch {
            msg("Failed to clear the saved image", false);
        }
    };

    return <ModalRoot {...modalProps} size={ModalSize.SMALL}>
        <ModalHeader>
            <h2 className="vc-draxxcord-stream-title">DraxxCord Custom Stream Image</h2>
            <ModalCloseButton onClick={close} />
        </ModalHeader>
        <ModalContent>
            <p className="vc-draxxcord-stream-intro">Choose a picture for your Discord screen-share thumbnail.</p>
            <p className="vc-draxxcord-stream-help">{active ? "Screen share detected." : "Start screen sharing to send the image."} Updates are attempted every 5 minutes while streaming.</p>
            <label className="vc-draxxcord-stream-choose">
                {busy ? "Processing..." : "Choose Image"}
                <input type="file" accept="image/*" disabled={busy} onChange={selectFile} hidden />
            </label>
            {preview && <img className="vc-draxxcord-stream-preview" src={preview} alt="Selected custom stream thumbnail" />}
        </ModalContent>
        <ModalFooter>
            <div className="vc-draxxcord-stream-actions">
                {preview && <button type="button" onClick={() => void removeImage()}>Clear Image</button>}
                {sending && <button type="button" className="vc-draxxcord-stream-stop" onClick={() => {
                    stopSendingPreview(); setSending(false); msg("Automatic preview upload stopped.");
                }}>Stop Sending</button>}
                <button type="button" onClick={close}>Close</button>
            </div>
        </ModalFooter>
    </ModalRoot>;
}

function ImageButton() {
    const openImage = () => {
        const key = openModal(props => <ImageModal modalProps={props} close={() => closeModal(key)} />);
    };
    return <button type="button" className="vc-draxxcord-account-button" title="DraxxCord Custom Stream Image" aria-label="DraxxCord Custom Stream Image" onClick={openImage}><ImageIcon /></button>;
}

let unmountAccountButton: (() => void) | null = null;

export default definePlugin({
    name: "DraxxCord Custom Stream Image",
    description: "DraxxCord screen-share thumbnail picker with local image storage and optional automatic sending.",
    authors: [], // Original author LOSTSTR is credited in the source header and README.
    tags: ["Voice", "Utility"],
    start() {
        unmountAccountButton = mountAccountButton("stream-image", host => {
            const root = createRoot(host);
            root.render(<ImageButton />);
            return () => root.unmount();
        });
    },
    flux: {
        async STREAM_CREATE({ streamKey }: StreamCreateEvent) {
            if (!belongsToCurrentUser(streamKey)) return;
            const saved = await getSavedPreview();
            if (saved && isStreaming()) startSendingPreview(saved, streamKey);
        },
        STREAM_DELETE({ streamKey }: StreamDeleteEvent) {
            if (belongsToCurrentUser(streamKey)) clearActiveStream();
        }
    },
    stop() {
        unmountAccountButton?.();
        unmountAccountButton = null;
        clearActiveStream();
    }
});
