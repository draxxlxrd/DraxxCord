/*
 * DraxxCord Panel v3 - source bridge UI (2026).
 * The original plugin logic lives in separate Vencord modules, with unmodified
 * reference copies supplied in ORIGINAL_B4LCORD_REFERENCE.
 */
import { isPluginEnabled, plugins, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { React } from "@webpack/common";

const modules = [
    { plugin: "DraxxCordMessageKeeper", title: "MessageKeeper", category: "Messages", info: "Saved deleted messages on your client" },
    { plugin: "DraxxCordLocalChannelAliases", title: "Channel Aliases", category: "Identity", info: "Locally rename channels" },
    { plugin: "DraxxCordQuietHours", title: "Quiet Hours", category: "Tools", info: "Silence notification sounds on schedule" },
    { plugin: "DraxxCordVoiceGuard", title: "VoiceGuard", category: "Voice", info: "Reconnect to a pinned voice channel" },
    { plugin: "DraxxCordLastOnlineTracker", title: "Last Online Tracker", category: "Social", info: "Keep a local last-seen record" },
    { plugin: "DraxxCordWhosWatching", title: "Who's Watching", category: "Voice", info: "Display stream spectators" },
    { plugin: "DraxxCordStreamProof", title: "StreamProof", category: "Privacy", info: "Blur messages and images when StreamProof is active" },
    { plugin: "DraxxCordNeverPausePreviews", title: "Never Pause Previews", category: "Voice", info: "Continue stream preview when Discord loses focus" }
] as const;

const groups = ["All", "Identity", "Messages", "Social", "Voice", "Privacy", "Tools"];

export function DraxxSourceLab() {
    const [filter, setFilter] = React.useState("All");
    const [, refresh] = React.useReducer((v: number) => v + 1, 0);
    const [notice, setNotice] = React.useState("");
    const [restart, setRestart] = React.useState(false);

    function toggle(name: string, desired: boolean) {
        const plugin = plugins[name];
        if (!plugin) { setNotice(name + " source not found in the current build."); return; }
        try {
            if (desired) {
                const dependencies = startDependenciesRecursive(plugin);
                if (dependencies?.failures?.length) {
                    setNotice("Dependency failed: " + dependencies.failures.join(", "));
                    return;
                }
                Settings.plugins[name].enabled = true;
                if (dependencies?.restartNeeded || pluginRequiresRestart(plugin)) {
                    setRestart(true);
                    setNotice(name + ": restart Discord to apply.");
                } else if (!startPlugin(plugin)) {
                    Settings.plugins[name].enabled = false;
                    setNotice(name + ": could not start. Check console.");
                } else { setNotice(name + " enabled."); }
            } else {
                if (pluginRequiresRestart(plugin)) {
                    Settings.plugins[name].enabled = false;
                    setRestart(true);
                    setNotice(name + ": restart Discord to disable.");
                } else if (plugin.started && !stopPlugin(plugin)) {
                    setNotice(name + ": could not stop. Check console.");
                } else {
                    Settings.plugins[name].enabled = false;
                    setNotice(name + " disabled.");
                }
            }
        } catch (err) {
            setNotice("Plugin error: " + String(err));
        }
        refresh();
    }

    const visible = modules.filter(m => filter === "All" || m.category === filter);
    const card: React.CSSProperties = { background: "rgba(15,15,21,.85)", padding: "12px", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, marginBottom: 8 };
    const btn: React.CSSProperties = { padding: "6px 10px", background: "#202027", border: "1px solid #383841", color: "white", borderRadius: 7, cursor: "pointer" };
    return <div style={{ padding: 16, color: "#fff", height: "100%", overflowY: "auto", fontFamily: "var(--font-primary)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>DRAXXCORD <span style={{ color: "#e33" }}>SOURCE LAB</span></div>
            <span style={{ color: "#999", fontSize: 11 }}>v3</span>
        </div>
        <div style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>Original b4lCord plugin logic, adapted for Vencord. Changes here affect actual plugin enablement.</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {groups.map(g => <button key={g} type="button" style={{ ...btn, background: filter === g ? "#7e111c" : "#202027" }} onClick={() => setFilter(g)}>{g}</button>)}
        </div>
        {restart && <div style={{ ...card, borderColor: "#c78a27", color: "#f8ce7d" }}>Changes to patched plugins need a full Discord restart.</div>}
        {notice && <div role="status" style={{ fontSize: 12, padding: "9px", marginBottom: 10, background: "#2a1b23", borderRadius: 6 }}>{notice}</div>}
        {visible.map(m => {
            const exists = !!plugins[m.plugin];
            const on = exists && !!isPluginEnabled(m.plugin);
            return <div key={m.plugin} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: "#aab", marginTop: 3 }}>{m.info}</div>
                        <div style={{ fontSize: 10, color: exists ? "#7cc999" : "#b99675", marginTop: 6 }}>{exists ? (on ? "Enabled" : "Disabled") : "Module missing from build"}</div>
                    </div>
                    <button type="button" disabled={!exists} aria-label={`${on ? "Disable" : "Enable"} ${m.title}`} style={{ ...btn, opacity: exists ? 1 : .3, background: on ? "#94232c" : "#303039", minWidth: 74 }} onClick={() => toggle(m.plugin, !on)}>{on ? "ON" : "OFF"}</button>
                </div>
            </div>;
        })}
        <p style={{ color: "#999", fontSize: 11, lineHeight: 1.5 }}>Note: the badges are managed in the separate Badges tab. For plugin-specific settings, open DraxxCord Settings → DraxxCord Plugins. Source modules are disabled by default until you enable them.</p>
    </div>;
}
