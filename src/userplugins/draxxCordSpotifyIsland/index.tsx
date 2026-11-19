/*
 * DraxxCord Spotify Island — Spotify-only adaptation of DynamicIslande.
 * Original DynamicIslande: irritably (2026), GPL-3.0-or-later.
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Mounts a dedicated React root. Unlike the earlier build, this does not rely
 * on a fragile Discord title-bar patch that may fail silently after an update.
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { SpotifyStore } from "@plugins/spotifyControls/SpotifyStore";
import definePlugin, { OptionType, StartAt } from "@utils/types";
import { createRoot, useEffect, useState, useStateFromStores } from "@webpack/common";
import type { MouseEvent, ReactNode } from "react";

const cl = (part: string) => `vc-draxxcord-spotify-${part}`;

const settings = definePluginSettings({
    color: {
        description: "Spotify Island appearance",
        type: OptionType.SELECT,
        options: [
            { label: "AMOLED black", value: "amoled" },
            { label: "Discord theme", value: "theme" },
            { label: "Metallic Silver", value: "silver", default: true },
            { label: "Crimson Red", value: "crimson" },
            { label: "Animated RGB", value: "rgb" }
        ]
    },
    // DRAXX-2.8.2-DIRECT-SPOTIFY
    hideWhenInactive: {
        description: "Hide Island when Spotify is not actively playing (including paused, idle and disconnected)",
        type: OptionType.BOOLEAN,
        default: true
    },
    glow: {
        description: "Enable Spotify Island silver or colored glow",
        type: OptionType.BOOLEAN,
        default: true
    },
    showIdleHint: {
        description: "Display an idle status pill when Discord cannot detect a Spotify song",
        type: OptionType.BOOLEAN,
        default: true
    },
    showWhilePaused: {
        description: "Keep Spotify Island visible when playback is paused",
        type: OptionType.BOOLEAN,
        default: true
    },
    hideOriginalSpotifyPlayer: {
        description: "Hide the separate SpotifyControls player above the Discord account panel. Spotify Island will still work.",
        type: OptionType.BOOLEAN,
        default: true,
        onChange: enabled => setOriginalPlayerHidden(enabled)
    }
});

function IconButton({ label, onClick, children }: {
    label: string;
    onClick(): void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={cl("control")}
            title={label}
            aria-label={label}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
                event.stopPropagation();
                onClick();
            }}
        >{children}</button>
    );
}

function SpotifyIsland() {
    const track = useStateFromStores([SpotifyStore], () => SpotifyStore.track);
    const playing = useStateFromStores([SpotifyStore], () => SpotifyStore.isPlaying);
    const { color, showWhilePaused, showIdleHint, hideWhenInactive, glow } = settings.use(["color", "showWhilePaused", "showIdleHint", "hideWhenInactive", "glow"]);
    const [expanded, setExpanded] = useState(false);
    const [, setClock] = useState(0);

    useEffect(() => {
        if (!playing || !track) return;
        const timer = window.setInterval(() => setClock(value => value + 1), 1000);
        return () => window.clearInterval(timer);
    }, [playing, track?.id]);

    // The connected Spotify account and SpotifyControls must supply a track.
    if (!track) {
        if (hideWhenInactive || !showIdleHint) return null;
        return <div className={[cl("root"), cl(`color-${color}`), cl("idle")].join(" ")} title="Connect Spotify to Discord, enable SpotifyControls, and play a song">
            <span className={cl("idle-icon")}>♫</span>
            <span className={cl("idle-label")}>Spotify not detected</span>
        </div>;
    }
    if (!playing && (hideWhenInactive || !showWhilePaused)) return null;

    const duration = Math.max(1, track.duration || 1);
    const position = Math.max(0, Math.min(duration, SpotifyStore.position || 0));
    const percentage = Math.min(100, position / duration * 100);
    const artists = (track.artists || []).map(artist => artist.name).join(", ");
    const art = track.album?.image?.url;
    const format = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;

    return (
        <div className={[cl("root"), cl(`color-${color}`), expanded ? cl("expanded") : "", playing ? cl("playing") : "", glow ? cl("glow") : ""].join(" ")}>
            <button
                type="button"
                className={cl("summary")}
                title={expanded ? "Collapse DraxxCord Spotify Island" : "Expand DraxxCord Spotify Island"}
                aria-expanded={expanded}
                onClick={() => setExpanded(value => !value)}
            >
                {art ? <img src={art} alt="Album artwork" className={cl("art")} draggable={false} /> : <span className={cl("placeholder")}>♫</span>}
                <span className={cl("copy")}>
                    <strong title={track.name}>{track.name}</strong>
                    <small title={artists}>{artists || "Spotify"}</small>
                </span>
                <span className={cl("equalizer")} aria-label={playing ? "Playing" : "Paused"}><i /><i /><i /></span>
                <span className={cl("progress-mini")} aria-hidden="true"><span style={{ width: `${percentage}%` }} /></span>
            </button>
            <div className={[cl("details"), expanded ? cl("details-open") : ""].join(" ")}>
                <div className={cl("buttons")}>
                    <IconButton label="Previous track" onClick={() => void SpotifyStore.prev()}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6V5Zm3 7 9-7v14l-9-7Z" /></svg>
                    </IconButton>
                    <IconButton label={playing ? "Pause" : "Play"} onClick={() => void SpotifyStore.setPlaying(!playing)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={playing ? "M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" : "M8 5v14l11-7L8 5Z"} /></svg>
                    </IconButton>
                    <IconButton label="Next track" onClick={() => void SpotifyStore.next()}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2V5ZM6 5l9 7-9 7V5Z" /></svg>
                    </IconButton>
                </div>
                <div className={cl("progress-row")}>
                    <span>{format(position)}</span>
                    <input
                        type="range"
                        aria-label="Seek Spotify track"
                        min={0}
                        max={duration}
                        step={1000}
                        value={position}
                        onChange={event => void SpotifyStore.seek(Number(event.currentTarget.value))}
                    />
                    <span>{format(duration)}</span>
                </div>
            </div>
        </div>
    );
}

const SafeIsland = ErrorBoundary.wrap(SpotifyIsland, {
    fallback: () => <div className={`${cl("root")} ${cl("error")}`}>DraxxCord Spotify Island: rendering error — check DevTools</div>
});
let mount: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let waitingForDom = false;

function setOriginalPlayerHidden(enabled: boolean) {
    document.body?.classList.toggle("vc-draxxcord-hide-original-spotify", enabled);
}

function attachIsland() {
    waitingForDom = false;
    if (!document.body) return;
    if (mount?.isConnected) return;

    // Do not silently disappear when the React mount fails.
    mount?.remove();
    mount = document.createElement("div");
    mount.id = "vc-draxxcord-spotify-island-mount";
    mount.dataset.draxxcordMounted = "yes";
    document.body.appendChild(mount);
    setOriginalPlayerHidden(settings.store.hideOriginalSpotifyPlayer);

    try {
        root = createRoot(mount);
        root.render(<SafeIsland />);
        console.info("[DraxxCord Spotify Island] Mounted in document.body");
    } catch (error) {
        console.error("[DraxxCord Spotify Island] Mount failed", error);
        mount.textContent = "DraxxCord Spotify: mount error — check DevTools";
        mount.className = "vc-draxxcord-spotify-mount-failed";
    }
}

function mountIsland() {
    if (document.body) {
        attachIsland();
    } else if (!waitingForDom) {
        waitingForDom = true;
        document.addEventListener("DOMContentLoaded", attachIsland, { once: true });
    }
}

function unmountIsland() {
    document.removeEventListener("DOMContentLoaded", attachIsland);
    waitingForDom = false;
    setOriginalPlayerHidden(false);
    try { root?.unmount(); } catch (error) { console.error("[DraxxCord Spotify Island] Unmount failed", error); }
    root = null;
    mount?.remove();
    mount = null;
}

export default definePlugin({
    name: "DraxxCord Spotify Island",
    description: "DraxxCord top-center Spotify Dynamic Island. Fixed mount timing and Spotify detection diagnostics.",
    authors: [{ name: "irritably (original DynamicIslande)", id: 928787166916640838n }],
    tags: ["Media"],
    dependencies: ["SpotifyControls"],
    settings,
    startAt: StartAt.WebpackReady,
    start: mountIsland,
    stop: unmountIsland
});
