/* DraxxCord RGB v5: visual settings only, never sends data or changes Discord APIs. */
import { useEffect, useState } from "@webpack/common";

type Palette = {
    accent: string;
    border: string;
    background: string;
    cards: string;
    text: string;
    glow: number;
    matchBorder: boolean;
    rainbow: boolean;
    speed: number;
};
type HexKey = "accent" | "border" | "background" | "cards" | "text";
const KEY = "draxxcord.umbral.rgb.v5";
const RED_BLACK: Palette = {
    accent: "#ff0000", border: "#ff0000", background: "#000000", cards: "#090909",
    text: "#ffffff", glow: 42, matchBorder: true, rainbow: false, speed: 8
};
const PRESETS: { label: string; accent: string; background: string; cards: string; text: string }[] = [
    { label: "Red / Black", accent: "#ff0000", background: "#000000", cards: "#090909", text: "#ffffff" },
    { label: "White / Black", accent: "#ffffff", background: "#000000", cards: "#0b0b0b", text: "#ffffff" },
    { label: "Ice Blue", accent: "#00bcff", background: "#02070c", cards: "#07121c", text: "#effaff" },
    { label: "Violet", accent: "#a45cff", background: "#06030c", cards: "#11091b", text: "#ffffff" },
    { label: "Emerald", accent: "#00e89a", background: "#000905", cards: "#09150f", text: "#f2fff7" }
];

function validHex(x: unknown): x is string { return typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x); }
function range(x: unknown, min: number, max: number, fallback: number): number {
    return typeof x === "number" && Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : fallback;
}
function load(): Palette {
    try {
        const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
        if (!parsed || typeof parsed !== "object") return { ...RED_BLACK };
        return {
            accent: validHex(parsed.accent) ? parsed.accent : RED_BLACK.accent,
            border: validHex(parsed.border) ? parsed.border : RED_BLACK.border,
            background: validHex(parsed.background) ? parsed.background : RED_BLACK.background,
            cards: validHex(parsed.cards) ? parsed.cards : RED_BLACK.cards,
            text: validHex(parsed.text) ? parsed.text : RED_BLACK.text,
            glow: range(parsed.glow, 0, 100, RED_BLACK.glow),
            matchBorder: typeof parsed.matchBorder === "boolean" ? parsed.matchBorder : true,
            rainbow: typeof parsed.rainbow === "boolean" ? parsed.rainbow : false,
            speed: range(parsed.speed, 2, 30, RED_BLACK.speed)
        };
    } catch { return { ...RED_BLACK }; }
}
function rgb(hex: string): string {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(",");
}
function hexChannel(hex: string, i: number): number { return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16); }
function channelColor(hex: string, i: number, n: number): string {
    const values = [0, 1, 2].map(j => j === i ? n : hexChannel(hex, j));
    return `#${values.map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
function writePalette(p: Palette, overrideAccent?: string) {
    const accent = overrideAccent ?? p.accent;
    const border = p.matchBorder ? accent : p.border;
    const root = document.documentElement;
    root.style.setProperty("--dc-rgb-accent", accent);
    root.style.setProperty("--dc-rgb-accent-rgb", rgb(accent));
    root.style.setProperty("--dc-rgb-border", border);
    root.style.setProperty("--dc-rgb-border-rgb", rgb(border));
    root.style.setProperty("--dc-rgb-bg", p.background);
    root.style.setProperty("--dc-rgb-card", p.cards);
    root.style.setProperty("--dc-rgb-text", p.text);
    root.style.setProperty("--dc-rgb-glow", String(p.glow / 100));
}

export function DraxxRGBController({ embedded = false, headless = false }: { embedded?: boolean; headless?: boolean }) {
    const [palette, setPalette] = useState<Palette>(load);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        try {
            const serialized = JSON.stringify(palette);
            if (localStorage.getItem(KEY) !== serialized) {
                localStorage.setItem(KEY, serialized);
                window.dispatchEvent(new Event("draxxcord:rgb-v6-updated"));
            }
        } catch { /* storage unavailable */ }
        writePalette(palette);
        // Only the always-mounted invisible instance runs the animation timer.
        if (!headless || !palette.rainbow || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const started = Date.now();
        const handle = window.setInterval(() => {
            const hue = Math.floor(((Date.now() - started) / (palette.speed * 1000) * 360) % 360);
            const color = `#${hslToRgbHex(hue, 100, 50)}`;
            writePalette(palette, color);
        }, 120);
        return () => window.clearInterval(handle);
    }, [palette, headless]);
    useEffect(() => {
        const sync = () => setPalette(load());
        window.addEventListener("draxxcord:rgb-v6-updated", sync);
        return () => window.removeEventListener("draxxcord:rgb-v6-updated", sync);
    }, []);

    function changeColor(key: HexKey, value: string) {
        if (!validHex(value)) return;
        setPalette(p => ({ ...p, [key]: value }));
    }
    function applyPreset(preset: typeof PRESETS[number]) {
        setPalette(p => ({ ...p, accent: preset.accent, background: preset.background, cards: preset.cards, text: preset.text, border: preset.accent, rainbow: false }));
    }
    if (headless) return <div className="draxx-rgb-controller draxx-rgb-headless" aria-hidden="true" />;
    return (
        <div className={embedded ? "draxx-rgb-controller draxx-rgb-inline" : "draxx-rgb-controller"}>
            {!embedded && <button type="button" className="draxx-rgb-launch" onClick={() => setOpen(o => !o)}
                aria-expanded={open} aria-label="Open DraxxCord RGB color settings" title="DraxxCord RGB Colors">
                <span className="draxx-rgb-swatch" /> RGB
            </button>}
            {(embedded || open) && <div className="draxx-rgb-editor" role="region" aria-label="DraxxCord RGB theme controls">
                <div className="draxx-rgb-head"><strong>DRAXXCORD RGB</strong>{!embedded && <button type="button" onClick={() => setOpen(false)} aria-label="Close RGB settings">×</button>}</div>
                <div className="draxx-rgb-note">Theme colors only. Badges always keep their original colors.</div>
                <div className="draxx-rgb-presets">
                    {PRESETS.map(p => <button key={p.label} type="button" onClick={() => applyPreset(p)}>{p.label}</button>)}
                </div>
                {([ ["Accent", "accent"], ["Border", "border"], ["Background", "background"], ["Cards", "cards"], ["Text", "text"] ] as [string, HexKey][]).map(([label, key]) => (
                    <label key={key} className="draxx-rgb-color-row">
                        <span>{label}</span>
                        <input type="color" value={palette[key]} onChange={e => changeColor(key, e.currentTarget.value)} disabled={key === "border" && palette.matchBorder} />
                        <code>{key === "border" && palette.matchBorder ? palette.accent.toUpperCase() : palette[key].toUpperCase()}</code>
                    </label>
                ))}
                <label className="draxx-rgb-check"><input type="checkbox" checked={palette.matchBorder} onChange={e => setPalette(p => ({ ...p, matchBorder: e.currentTarget.checked }))} /> Border follows Accent</label>
                <div className="draxx-rgb-label">Fine RGB accent channels</div>
                {(["R", "G", "B"] as const).map((name, i) => <label key={name} className="draxx-rgb-slider-row"><span>{name}</span><input type="range" min="0" max="255" value={hexChannel(palette.accent, i)} onChange={e => changeColor("accent", channelColor(palette.accent, i, Number(e.currentTarget.value)))} /><output>{hexChannel(palette.accent, i)}</output></label>)}
                <label className="draxx-rgb-slider-row"><span>Glow</span><input type="range" min="0" max="100" value={palette.glow} onChange={e => setPalette(p => ({ ...p, glow: Number(e.currentTarget.value) }))}/><output>{palette.glow}%</output></label>
                <label className="draxx-rgb-check"><input type="checkbox" checked={palette.rainbow} onChange={e => setPalette(p => ({ ...p, rainbow: e.currentTarget.checked }))} /> Animated RGB cycling</label>
                {palette.rainbow && <label className="draxx-rgb-slider-row"><span>Speed</span><input type="range" min="2" max="30" value={palette.speed} onChange={e => setPalette(p => ({ ...p, speed: Number(e.currentTarget.value) }))}/><output>{palette.speed}s</output></label>}
                <button type="button" className="draxx-rgb-reset" onClick={() => setPalette({ ...RED_BLACK })}>Reset to original RED / BLACK</button>
            </div>}
        </div>
    );
}

function hslToRgbHex(h: number, s: number, l: number): string {
    const c = (1 - Math.abs(2 * l / 100 - 1)) * s / 100;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l / 100 - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g] = [c, x];
    else if (h < 120) [r, g] = [x, c];
    else if (h < 180) [g, b] = [c, x];
    else if (h < 240) [g, b] = [x, c];
    else if (h < 300) [r, b] = [x, c];
    else [r, b] = [c, x];
    return [r, g, b].map(n => Math.round((n + m) * 255).toString(16).padStart(2, "0")).join("");
}
