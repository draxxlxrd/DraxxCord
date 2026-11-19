/*
 * DraxxCord minimal Calendar port (original b4lCord source retained separately).
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Local notes/timestamps, no Discord network calls.
 */
import * as DataStore from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { copyWithToast } from "@utils/discord";
import definePlugin, { OptionType } from "@utils/types";
import { React, useEffect, useState } from "@webpack/common";

const NOTES_KEY = "draxxcord-calendar-notes-v1";
type Notes = Record<string, string>;
function CalendarPanel() {
    const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
    const [notes, setNotes] = useState<Notes>({});
    const [saving, setSaving] = useState(false);
    useEffect(() => { let alive = true; void DataStore.get(NOTES_KEY).then((value: any) => {
        if (alive && value && typeof value === "object") setNotes(value);
    }).catch(e => console.warn("[DraxxCord Calendar] load error", e)); return () => { alive = false; }; }, []);
    const update = (text: string) => setNotes(old => ({ ...old, [date]: text }));
    const save = async () => { setSaving(true); try { await DataStore.set(NOTES_KEY, notes); } finally { setSaving(false); } };
    const copy = (fmt: "d" | "F" | "R") => {
        const timestamp = Math.floor(new Date(date + "T12:00:00").getTime() / 1000);
        if (Number.isFinite(timestamp)) copyWithToast(`<t:${timestamp}:${fmt}>`);
    };
    const fieldStyle: React.CSSProperties = { width: "100%", padding: "8px", background: "var(--input-background)", color: "var(--text-normal)", borderRadius: 6, border: "1px solid var(--background-modifier-accent)" };
    return <div style={{ padding: 12, display: "grid", gap: 10, maxWidth: 520 }}>
        <strong>DraxxCord Calendar — Local Notes</strong>
        <label>Choose a date <input aria-label="Calendar date" type="date" value={date} onChange={e => setDate(e.currentTarget.value)} style={fieldStyle}/></label>
        <label>Note for {date}<textarea aria-label="Calendar note" rows={5} value={notes[date] ?? ""} onChange={e => update(e.currentTarget.value)} style={{ ...fieldStyle, resize: "vertical" }}/></label>
        <button onClick={() => void save()} disabled={saving} style={{ ...fieldStyle, cursor: "pointer" }}>{saving ? "Saving..." : "Save notes locally"}</button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => copy("d")}>Copy short date</button>
            <button onClick={() => copy("F")}>Copy full date/time</button>
            <button onClick={() => copy("R")}>Copy relative timestamp</button>
        </div>
        <small>Notes are stored locally by Vencord. You must press Save. Times default to 12:00 local time. This is a simplified settings-panel version of the original calendar.</small>
    </div>;
}
const settings = definePluginSettings({ calendar: { type: OptionType.COMPONENT, component: CalendarPanel } });
export default definePlugin({
    name: "DraxxCord Calendar",
    description: "Local calendar notes and Discord timestamps (in plugin Settings).",
    authors: [{ name: "x2b", id: 996137713432530976n }],
    settings,
});
