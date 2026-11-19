/*
 * DraxxCord FakeDM Media Injector extension
 * Additive module for existing FakeDM. Nothing is sent to Discord.
 * The UI only dispatches local MESSAGE_CREATE events. Original FakeDM code is untouched.
 * Copyright (c) 2026 DraxxCord contributors; GPL-3.0-or-later.
 */
import "./mediaInjector.css";
import { openImageModal } from "@utils/discord";

import { ModalContent as RawContent, ModalHeader as RawHeader, ModalRoot as RawRoot, ModalSize, openModal } from "@utils/modal";
import { Logger } from "@utils/Logger";
import { ChannelStore, FluxDispatcher, MessageStore, React, SelectedChannelStore, UserStore } from "@webpack/common";

const log = new Logger("DraxxCordMediaInjector");
const ModalRoot = RawRoot as unknown as React.ComponentType<any>;
const ModalHeader = RawHeader as unknown as React.ComponentType<any>;
const ModalContent = RawContent as unknown as React.ComponentType<any>;
const DATABASE_NAME = "draxxcord-fakedm-media-v1";
const STORE = "items";
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 75 * 1024 * 1024;
const MAX_GIF_URL_LENGTH = 2048;

export type MediaKind = "image" | "gif" | "video";
type MediaRecord = {
    id: string;
    channelId: string;
    authorId: string;
    timestamp: string;
    kind: MediaKind;
    name: string;
    mime: string;
    size: number;
    width: number;
    height: number;
    // Files are stored as Blobs in IndexedDB, NEVER uploaded to Discord.
    blob?: Blob;
    remoteUrl?: string;
};

const localMessages = new Map<string, Set<string>>();
const blobUrls = new Map<string, string>();
// Tracks only Media Injector message IDs; never touches real Discord messages.
const accessoryRecords = new Map<string, MediaRecord>();
let started = false;
let dbPromise: Promise<IDBDatabase> | undefined;
let sequence = 3500;

function createId(date: Date) {
    const elapsed = Math.max(0, date.getTime() - 1420070400000);
    return ((BigInt(elapsed) << 22n) | BigInt((sequence++ % 596) + 3500)).toString();
}

function openDatabase(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available in this Discord client"));
        const req = indexedDB.open(DATABASE_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Unable to open media database"));
        req.onblocked = () => reject(new Error("Media database is blocked"));
    }).catch(err => {
        dbPromise = undefined; // allow retry on next operation
        throw err;
    });
    return dbPromise;
}

async function saveRecord(rec: MediaRecord): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Media save failed"));
        tx.onabort = () => reject(tx.error ?? new Error("Media save aborted"));
    });
}

async function recordsForChannel(channelId: string): Promise<MediaRecord[]> {
    const db = await openDatabase();
    const rows = await new Promise<MediaRecord[]>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as MediaRecord[]);
        req.onerror = () => reject(req.error ?? new Error("Media list failed"));
    });
    return rows.filter(row => row.channelId === channelId).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

async function deleteRecord(id: string): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("Media delete failed"));
    });
}

function getActiveDM(): any | null {
    const channelId = SelectedChannelStore.getChannelId();
    const channel = channelId && ChannelStore.getChannel(channelId);
    return channel && (channel.type === 1 || channel.type === 3) ? channel : null;
}

function membersForChannel(channel: any): any[] {
    const current = UserStore.getCurrentUser();
    return [current, ...(channel?.recipients ?? []).filter((id: string) => id !== current?.id).map((id: string) => UserStore.getUser(id))].filter(Boolean);
}

function makeAuthor(user: any) {
    return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator ?? "0",
        global_name: user.globalName ?? user.username,
        avatar: user.avatar ?? null,
        avatar_decoration_data: user.avatarDecorationData ? {
            asset: user.avatarDecorationData.asset, sku_id: user.avatarDecorationData.skuId,
        } : null,
        public_flags: user.publicFlags ?? 0,
        flags: user.flags ?? 0,
    };
}

function attachmentUrl(rec: MediaRecord): string | null {
    if (rec.kind === "gif") return rec.remoteUrl ?? null;
    if (blobUrls.has(rec.id)) return blobUrls.get(rec.id)!;
    if (!rec.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    blobUrls.set(rec.id, url);
    return url;
}

/**
 * Discord's native attachment renderer does not reliably accept blob: URLs.
 * Use the Vencord MessageAccessoriesAPI to render the locally selected file
 * through standard React <img>/<video> tags instead of a native attachment.
 * No message is sent over Discord's API.
 */
/* DRAXXCORD_NATIVE_VIEWER_V22_5: bridge local media to Discord's own image viewer. */
function readDraxxImageAsDataUrl(image: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error || new Error("Could not read local image"));
        reader.onload = () => {
            const data = reader.result;
            if (typeof data === "string" && data.startsWith("data:image/")) resolve(data);
            else reject(new Error("Invalid local image encoding"));
        };
        reader.readAsDataURL(image);
    });
}

async function openDraxxNativeImage(record: MediaRecord, inlineUrl: string) {
    // Never upload media. The base64 data URI exists only in the local client.
    // Discord can reject data: URLs on certain builds, so do not claim universal support.
    const nativeUrl = record.blob ? await readDraxxImageAsDataUrl(record.blob) : inlineUrl;
    openImageModal({
        url: nativeUrl,
        original: record.blob ? inlineUrl : nativeUrl,
        width: Math.max(1, record.width || 400),
        height: Math.max(1, record.height || 300)
    });
}

/* DRAXXCORD_NATIVE_VIEWER_V22_6: local-only files do not have an HTTPS original URL.
 * The media modal still previews the photo, but external Open Link cannot open a local image.
 * Use the small Save button instead of navigating to base64 data.
 */
function saveDraxxLocalOriginal(record: MediaRecord, src: string) {
    if (!record.blob) return;
    const mime = record.blob.type || record.mime || 'image/png';
    const ext = mime.includes('jpeg') ? '.jpg' : mime.includes('gif') ? '.gif' : mime.includes('webp') ? '.webp' : '.png';
    const name = (record.name || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120) || ('DraxxCord-image' + ext);
    const link = document.createElement('a');
    link.href = src;
    link.download = name;
    link.rel = 'noopener noreferrer';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function MediaAttachmentAccessory({ record }: { record: MediaRecord; }) {
    const [failed, setFailed] = React.useState(false);
    // DRAXXCORD_MEDIA_FRAME_V22_3: image intrinsic size controls the clickable frame width.
    const [naturalDimensions, setNaturalDimensions] = React.useState<{ width: number; height: number; } | null>(null);
    const url = attachmentUrl(record);
    React.useEffect(() => { setFailed(false); setNaturalDimensions(null); }, [url]);
    if (!url) return <div className="dc-media-inline-error">Local media is unavailable. Reopen Media Injector and remove this entry.</div>;
    const isVideo = record.kind === "video";
    const sourceWidth = Math.max(1, naturalDimensions?.width || record.width || 400);
    const sourceHeight = Math.max(1, naturalDimensions?.height || record.height || 300);
    const displayScale = Math.min(1, 500 / sourceWidth, 430 / sourceHeight);
    const displayWidth = Math.max(1, Math.round(sourceWidth * displayScale));
    return <div className="dc-media-inline" data-dc-media-id={record.id} style={isVideo ? undefined : { width: `${displayWidth}px`, maxWidth: "100%" }}>
        {failed
            ? <div className="dc-media-inline-error">Media couldn't be loaded in this Discord client.</div>
            : isVideo
                ? <video src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} />
                : <button
                    type="button"
                    className="dc-media-open-image"
                    aria-label={`Open ${record.kind === "gif" ? "GIF" : "image"} in local image viewer`}
                    title="Open in Discord viewer (use ↓ to save the local original)"
                    onClick={e => {
                        e.stopPropagation();
                        // Open the local viewer using the same URL that already renders inline.
                        // blob: URLs come from our local IndexedDB image store.
                        void openDraxxNativeImage(record, url).catch(err => {
                            log.error("Unable to open local media in native Discord viewer", err);
                        });
                    }}
                >
                    <img src={url} alt={record.name || "Locally injected image"} loading="lazy" referrerPolicy="no-referrer"
                        onLoad={e => {
                            const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
                            if (width > 0 && height > 0) {
                                setNaturalDimensions(prev => prev?.width === width && prev?.height === height ? prev : { width, height });
                            }
                        }} onError={() => setFailed(true)} />
                </button>}
        {!isVideo && record.blob && !failed && <button
            type="button"
            className="dc-media-save-original"
            title="Save original image locally (no public Open Link for local uploads)"
            aria-label="Save original local image"
            onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                saveDraxxLocalOriginal(record, url);
            }}
        >↓</button>}
    </div>;
}

/** Called only by FakeDM's declarative MessageAccessoriesAPI hook. */
export function renderMediaAccessory(props: any) {
    const msg = props?.message;
    if (!msg) return null;
    const record = accessoryRecords.get(msg.id);
    if (!record || msg.channel_id !== record.channelId) return null;
    return <MediaAttachmentAccessory key={record.id} record={record} />;
}

/** Only a local Flux event; media is provided by the accessory renderer. */
function injectLocalMedia(rec: MediaRecord): boolean {
    const user = UserStore.getUser(rec.authorId);
    const url = attachmentUrl(rec);
    if (!user || !url) return false;
    // Must be available before MESSAGE_CREATE triggers the React render.
    accessoryRecords.set(rec.id, rec);
    if (MessageStore.getMessage(rec.channelId, rec.id)) return true;
    FluxDispatcher.dispatch({
        type: "MESSAGE_CREATE",
        channelId: rec.channelId,
        message: {
            id: rec.id,
            channel_id: rec.channelId,
            author: makeAuthor(user),
            // Never pass a blob: URL through Discord's native attachment renderer.
            attachments: [],
            embeds: [], components: [], mentions: [], mention_roles: [],
            // Zero-width content keeps a media-only local message mounted.
            content: "\u200b", edited_timestamp: null, flags: 0,
            mention_everyone: false,
            nonce: rec.id, pinned: false, tts: false, type: 0,
            timestamp: rec.timestamp,
        },
        optimistic: false,
        isPushNotification: false,
    });
    if (!localMessages.has(rec.channelId)) localMessages.set(rec.channelId, new Set());
    localMessages.get(rec.channelId)!.add(rec.id);
    return true;
}

async function restoreFor(channelId: string) {
    if (!started || !channelId) return;
    try {
        for (const record of await recordsForChannel(channelId)) {
            if (!started) return;
            injectLocalMedia(record);
        }
    } catch (err) {
        log.error("Unable to restore saved fake media", err);
    }
}

function onMessagesLoaded(e: any) {
    if (e?.channelId) setTimeout(() => void restoreFor(e.channelId), 180);
}
function onSelectedChannel(e: any) {
    if (e?.channelId) setTimeout(() => void restoreFor(e.channelId), 500);
}

export function startMediaInjector() {
    if (started) return;
    started = true;
    FluxDispatcher.subscribe("LOAD_MESSAGES_SUCCESS", onMessagesLoaded);
    FluxDispatcher.subscribe("CHANNEL_SELECT", onSelectedChannel);
    const id = SelectedChannelStore.getChannelId();
    if (id) setTimeout(() => void restoreFor(id), 600);
}

export function stopMediaInjector() {
    if (!started) return;
    started = false;
    FluxDispatcher.unsubscribe("LOAD_MESSAGES_SUCCESS", onMessagesLoaded);
    FluxDispatcher.unsubscribe("CHANNEL_SELECT", onSelectedChannel);
    for (const [channelId, ids] of localMessages) {
        for (const id of ids) FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId, id, mlDeleted: true });
    }
    localMessages.clear();
    accessoryRecords.clear();
    for (const url of blobUrls.values()) URL.revokeObjectURL(url);
    blobUrls.clear();
    // Saved IndexedDB entries remain for reload, unlike the in-memory fake messages.
}

async function deleteInjected(rec: MediaRecord) {
    await deleteRecord(rec.id);
    FluxDispatcher.dispatch({ type: "MESSAGE_DELETE", channelId: rec.channelId, id: rec.id, mlDeleted: true });
    localMessages.get(rec.channelId)?.delete(rec.id);
    accessoryRecords.delete(rec.id);
    const url = blobUrls.get(rec.id);
    if (url) URL.revokeObjectURL(url);
    blobUrls.delete(rec.id);
}

function validGifUrl(input: string): string | null {
    try {
        const url = new URL(input.trim());
        if (url.protocol !== "https:" || url.href.length > MAX_GIF_URL_LENGTH) return null;
        // A Tenor/Giphy page URL is NOT a direct GIF file; do not pretend it is.
        if (!/\.(?:gif)(?:$|[?#])/i.test(url.href)) return null;
        return url.href;
    } catch { return null; }
}

function localDateInput(date: Date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function getMediaDimensions(file: File, url: string): Promise<{ width: number; height: number; }> {
    return new Promise(resolve => {
        let settled = false;
        const finish = (width: number, height: number) => {
            if (settled) return;
            settled = true;
            resolve({ width: Math.max(1, width || 1), height: Math.max(1, height || 1) });
        };
        if (file.type.startsWith("video/")) {
            const el = document.createElement("video");
            el.preload = "metadata";
            el.onloadedmetadata = () => { finish(el.videoWidth || 640, el.videoHeight || 360); el.removeAttribute("src"); el.load(); };
            el.onerror = () => finish(640, 360);
            el.src = url;
        } else {
            const el = new Image();
            el.onload = () => finish(el.naturalWidth || 400, el.naturalHeight || 300);
            el.onerror = () => finish(400, 300);
            el.src = url;
        }
        setTimeout(() => finish(file.type.startsWith("video/") ? 640 : 400, file.type.startsWith("video/") ? 360 : 300), 2500);
    });
}

function MediaInjectorModal({ modalProps }: { modalProps: any; }) {
    const channel = getActiveDM();
    const members = channel ? membersForChannel(channel) : [];
    const current = UserStore.getCurrentUser();
    const [kind, setKind] = React.useState<MediaKind>("image");
    const [authorId, setAuthorId] = React.useState(members.find(u => u.id !== current?.id)?.id ?? current?.id ?? "");
    const [when, setWhen] = React.useState(localDateInput(new Date()));
    const [file, setFile] = React.useState<File | null>(null);
    const [filePreview, setFilePreview] = React.useState("");
    const [gifInput, setGifInput] = React.useState("");
    const [error, setError] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const [saved, setSaved] = React.useState<MediaRecord[]>([]);

    React.useEffect(() => {
        if (!file) { setFilePreview(""); return; }
        const src = URL.createObjectURL(file);
        setFilePreview(src);
        return () => URL.revokeObjectURL(src);
    }, [file]);

    const refreshSaved = React.useCallback(async () => {
        if (!channel) return;
        try { setSaved(await recordsForChannel(channel.id)); }
        catch (err) { log.error("Could not list saved fake media", err); }
    }, [channel?.id]);
    React.useEffect(() => { void refreshSaved(); }, [refreshSaved]);

    function selectFile(e: React.ChangeEvent<HTMLInputElement>) {
        setError("");
        const selected = e.currentTarget.files?.[0] ?? null;
        e.currentTarget.value = "";
        if (!selected) return;
        const isImage = /^image\/(?:jpeg|png|webp|gif)$/.test(selected.type);
        const isVideo = /^video\/(?:mp4|webm|ogg)$/.test(selected.type);
        if ((kind === "image" && !isImage) || (kind === "video" && !isVideo)) {
            setError("Choose a supported image (PNG/JPG/WEBP/GIF) or video (MP4/WEBM/OGG).");
            return;
        }
        if (selected.size > (kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) {
            setError(`File too large: limit ${kind === "image" ? 15 : 75} MB.`);
            return;
        }
        setFile(selected);
    }

    async function inject() {
        if (!channel || busy) return;
        setError("");
        const author = UserStore.getUser(authorId);
        if (!author) { setError("Choose a sender first."); return; }
        const date = new Date(when);
        if (!Number.isFinite(date.getTime())) { setError("Choose a valid date/time."); return; }
        const isGif = kind === "gif";
        const url = isGif ? validGifUrl(gifInput) : null;
        if (isGif && !url) { setError("Use a DIRECT HTTPS .gif image link, not a Tenor/Giphy webpage."); return; }
        if (!isGif && !file) { setError("Choose a file first."); return; }
        setBusy(true);
        try {
            const dimensions = file && filePreview ? await getMediaDimensions(file, filePreview) : { width: 400, height: 300 };
            const rec: MediaRecord = {
                id: createId(date), channelId: channel.id, authorId: author.id,
                timestamp: date.toISOString(), kind,
                name: isGif ? "animation.gif" : file!.name,
                mime: isGif ? "image/gif" : file!.type,
                size: isGif ? 0 : file!.size,
                width: dimensions.width, height: dimensions.height,
                ...(isGif ? { remoteUrl: url! } : { blob: file! }),
            };
            // Save to IndexedDB before injecting, so local files can be restored on reload.
            // If storage fails, still permit a session-only local preview and warn the user.
            try { await saveRecord(rec); }
            catch (err) {
                log.error("Media could not be persisted", err);
                setError("Media injected for this session only; persistent local storage failed.");
            }
            if (!injectLocalMedia(rec)) {
                setError("Could not display the media locally in this DM. Try another file or reopen the channel.");
            } else {
                if (!isGif) setFile(null);
                await refreshSaved();
            }
        } catch (err) {
            log.error("Media injection failed", err);
            setError("Unable to add media. Check the selected format and retry.");
        } finally { setBusy(false); }
    }

    const ready = !!channel && (kind === "gif" ? !!validGifUrl(gifInput) : !!file);
    const gif = kind === "gif" ? validGifUrl(gifInput) : null;
    return (
        <ModalRoot {...modalProps} size={ModalSize.MEDIUM}>
            <ModalHeader>Fake DM — Media Injector</ModalHeader>
            <ModalContent>
                <div className="dc-media-root">
                    <p className="dc-media-note">Local only. Nothing is uploaded or sent. This imitates a media-only DM in your client.</p>
                    {!channel && <p className="dc-media-error">Open a DM or group DM before using Media Injector.</p>}
                    <div className="dc-media-switch">
                        {(["image", "gif", "video"] as const).map(k => (
                            <button key={k} className={kind === k ? "dc-media-on" : ""} onClick={() => { setKind(k); setFile(null); setError(""); }}>
                                {k === "image" ? "Image Upload" : k === "gif" ? "GIF Link" : "Video Upload"}
                            </button>
                        ))}
                    </div>
                    <label className="dc-media-label">Sender</label>
                    <div className="dc-media-switch">
                        {members.map(m => <button key={m.id} className={authorId === m.id ? "dc-media-on" : ""} onClick={() => setAuthorId(m.id)}>{m.id === current?.id ? "You" : (m.globalName ?? m.username)}</button>)}
                    </div>
                    <label className="dc-media-label">When</label>
                    <input type="datetime-local" className="dc-media-input" value={when} onChange={e => setWhen(e.currentTarget.value)} />
                    {kind === "gif" ? <>
                        <label className="dc-media-label">Direct GIF URL</label>
                        <input className="dc-media-input" type="url" value={gifInput} onChange={e => setGifInput(e.currentTarget.value)} placeholder="https://media.tenor.com/.../example.gif" />
                    </> : <>
                        <label className="dc-media-label">{kind === "video" ? "Upload video (MP4 / WEBM / OGG, max 75 MB)" : "Upload picture (PNG / JPG / WEBP / GIF, max 15 MB)"}</label>
                        <input className="dc-media-file" type="file" accept={kind === "video" ? "video/mp4,video/webm,video/ogg" : "image/png,image/jpeg,image/webp,image/gif"} onChange={selectFile} />
                        {file && <span className="dc-media-filename">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>}
                    </>}
                    {((kind === "gif" && gif) || (kind !== "gif" && filePreview)) && <div className="dc-media-preview">
                        {kind === "video" ? <video src={filePreview} controls preload="metadata" /> : <img src={kind === "gif" ? gif! : filePreview} alt="Preview" />}
                    </div>}
                    {!!error && <p className="dc-media-error">{error}</p>}
                    <div className="dc-media-actions">
                        <button className="dc-media-primary" disabled={!ready || busy} onClick={() => void inject()}>{busy ? "Adding…" : "Inject Media Only"}</button>
                        <button onClick={() => { setFile(null); setGifInput(""); setError(""); }}>Clear selection</button>
                    </div>
                    <p className="dc-media-note">Saved locally in IndexedDB when permitted. Local GIF URLs require internet; uploaded videos are never sent to Discord.</p>
                    {saved.length > 0 && <>
                        <label className="dc-media-label">Injected media in this DM ({saved.length})</label>
                        <div className="dc-media-saved">
                            {saved.map(item => <div key={item.id} className="dc-media-saved-row">
                                <span>{item.kind.toUpperCase()} · {item.name}</span>
                                <button onClick={() => void deleteInjected(item).then(refreshSaved).catch(err => { log.error("Media deletion failed", err); setError("Unable to delete saved media."); })}>Remove</button>
                            </div>)}
                        </div>
                    </>}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export function openMediaInjector() {
    openModal(props => <MediaInjectorModal modalProps={props} />);
}
