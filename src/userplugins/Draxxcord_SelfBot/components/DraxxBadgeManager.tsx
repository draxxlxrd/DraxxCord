/*
 * DraxxCord Panel v2 — optional local badge selector inside the EXISTING Umbral panel.
 * New code only; does not edit original voice / fake-state / account logic.
 * Original plugin credits and GPL-3.0-or-later terms are preserved.
 */
import "./DraxxBadgeManager.css";

import { BadgePosition, ProfileBadge } from "@api/Badges";
import { React, UserStore } from "@webpack/common";

interface CatalogBadge { id: string; name: string; group: string; src: string; }
export const CATALOG: CatalogBadge[] = [
    { id: "staff", name: "Discord Staff", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png" },
    { id: "partner", name: "Partnered Server Owner", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png" },
    { id: "hype_events", name: "HypeSquad Events", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" },
    { id: "bug_1", name: "Bug Hunter Level 1", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png" },
    { id: "bug_2", name: "Golden Bug Hunter Level 2", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png" },
    { id: "bravery", name: "HypeSquad Bravery", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png" },
    { id: "brilliance", name: "HypeSquad Brilliance", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png" },
    { id: "balance", name: "HypeSquad Balance", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png" },
    { id: "early", name: "Early Supporter", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png" },
    { id: "mod", name: "Moderator Program Alumni", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png" },
    { id: "developer_legacy", name: "Early Verified Developer", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/6df5892e0f35b051f8b61eace34f4967.png" },
    { id: "developer_active", name: "Active Developer (retired)", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png" },
    { id: "legacy_name", name: "Legacy Username", group: "Legacy / Special", src: "https://cdn.discordapp.com/badge-icons/6de6d34650760ba5551a79732e98ed60.png" },
    { id: "nitro_base", name: "Nitro Subscriber", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png" },
    { id: "nitro_bronze", name: "Nitro Bronze", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/4f33c4a9c64ce221936bd256c356f91f.png" },
    { id: "nitro_silver", name: "Nitro Silver", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/4514fab914bdbfb4ad2fa23df76121a6.png" },
    { id: "nitro_gold", name: "Nitro Gold", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/2895086c18d5531d499862e41d1155a6.png" },
    { id: "nitro_platinum", name: "Nitro Platinum", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/0334688279c8359120922938dcb1d6f8.png" },
    { id: "nitro_diamond", name: "Nitro Diamond", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/0d61871f72bb9a33a7ae568c1fb4f20a.png" },
    { id: "nitro_emerald", name: "Nitro Emerald", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/11e2d339068b55d3a506cff34d3780f3.png" },
    { id: "nitro_ruby", name: "Nitro Ruby", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/cd5e2cfd9d7f27a8cdcd3e8a8d5dc9f4.png" },
    { id: "nitro_opal", name: "Nitro Opal", group: "Nitro", src: "https://cdn.discordapp.com/badge-icons/5b154df19c53dce2af92c9b61e6be5e2.png" },
    { id: "boost_1", name: "Server Boost · 1 Month", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/51040c70d4f20a921ad6674ff86fc95c.png" },
    { id: "boost_2", name: "Server Boost · 2 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/0e4080d1d333bc7ad29ef6528b6f2fb7.png" },
    { id: "boost_3", name: "Server Boost · 3 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/72bed924410c304dbe3d00a6e593ff59.png" },
    { id: "boost_6", name: "Server Boost · 6 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/df199d2050d3ed4ebf84d64ae83989f8.png" },
    { id: "boost_9", name: "Server Boost · 9 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/996b3e870e8a22ce519b3a50e6bdd52f.png" },
    { id: "boost_12", name: "Server Boost · 12 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/991c9f39ee33d7537d9f408c3e53141e.png" },
    { id: "boost_15", name: "Server Boost · 15 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/cb3ae83c15e970e8f3d410bc62cb8b99.png" },
    { id: "boost_18", name: "Server Boost · 18 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/7142225d31238f6387d9f09efaa02759.png" },
    { id: "boost_24", name: "Server Boost · 24 Months", group: "Server Boost", src: "https://cdn.discordapp.com/badge-icons/ec92202290b48d0879b7413d2dde3bab.png" },
    { id: "quest", name: "Discord Quest", group: "Other", src: "https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png" },
    { id: "orbs", name: "Discord Orbs", group: "Other", src: "https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png" },
];

const STORAGE = "draxxcord-panel-v2-badges-local";
const KNOWN = new Set(CATALOG.map(badge => badge.id));
let enabledIds = new Set<string>();

function readEnabled(): Set<string> {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE) || "[]");
        if (Array.isArray(stored)) return new Set(stored.filter((id): id is string => typeof id === "string" && KNOWN.has(id)));
    } catch { /* invalid local setting should not break Discord */ }
    return new Set();
}
enabledIds = readEnabled();

function saveEnabled(next: Set<string>) {
    enabledIds = next;
    try { localStorage.setItem(STORAGE, JSON.stringify([...next])); }
    catch { /* storage unavailable: leave in-memory toggles working */ }
}

// BadgeAPI reads these from the same Umbral/DraxxCord plugin — not a second plugin.
// BadgeAPI may cache profile content; close/reopen the user profile after changing a toggle.
export const draxxCordV2ProfileBadge: ProfileBadge = {
    id: "draxxcord-v2-badge-catalog",
    key: "DraxxCord Local Badges",
    description: "Local-only DraxxCord badges",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => userId === UserStore.getCurrentUser()?.id && enabledIds.size > 0,
    getBadges: () => CATALOG.filter(badge => enabledIds.has(badge.id)).map(badge => ({
        id: `draxxcord-v2-${badge.id}`,
        key: badge.name,
        description: `DraxxCord local preview — ${badge.name}`,
        iconSrc: badge.src,
        props: { style: { width: 22, height: 22, objectFit: "contain" as const } }
    }))
};

const GROUPS = ["All", "Legacy / Special", "Nitro", "Server Boost", "Other"];

export function DraxxBadgeManager() {
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set(enabledIds));
    const [group, setGroup] = React.useState("All");
    const [search, setSearch] = React.useState("");
    const filtered = CATALOG.filter(b => (group === "All" || b.group === group) && b.name.toLowerCase().includes(search.trim().toLowerCase()));
    function update(next: Set<string>) { setSelected(next); saveEnabled(next); }
    function toggle(id: string) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        update(next);
    }
    function setVisible(checked: boolean) {
        const next = new Set(selected);
        for (const badge of filtered) if (checked) next.add(badge.id); else next.delete(badge.id);
        update(next);
    }
    const preview = CATALOG.filter(b => selected.has(b.id));
    return (
        <div className="dc-v2-root">
            <header className="dc-v2-heading">
                <div>
                    <strong>BADGE MANAGER <span>V2</span></strong>
                    <small>Discord badge icons · Individual toggles</small>
                </div>
                <b>{selected.size} / {CATALOG.length}</b>
            </header>
            <div className="dc-v2-note">Local preview only. Badges are not granted by Discord and are visible only in your modified client. Reopen your profile after changing a toggle.</div>
            <div className="dc-v2-preview">
                <div className="dc-v2-preview-label">ACTIVE BADGES</div>
                <div className="dc-v2-preview-images">
                    {preview.length ? preview.map(b => <img key={b.id} src={b.src} title={b.name} alt={b.name} />) : <span>No badge selected</span>}
                </div>
            </div>
            <input className="dc-v2-search" type="search" placeholder="Search badges..." aria-label="Search badge catalog" value={search} onChange={e => setSearch(e.currentTarget.value)} />
            <div className="dc-v2-groups">
                {GROUPS.map(g => <button type="button" key={g} className={group === g ? "dc-v2-group-active" : ""} onClick={() => setGroup(g)}>{g}</button>)}
            </div>
            <div className="dc-v2-toolbar">
                <span>{filtered.length} badges shown</span>
                <div>
                    <button type="button" onClick={() => setVisible(true)}>Enable shown</button>
                    <button type="button" onClick={() => setVisible(false)}>Disable shown</button>
                </div>
            </div>
            <div className="dc-v2-grid">
                {filtered.map(badge => <label key={badge.id} className={`dc-v2-badge-card ${selected.has(badge.id) ? "dc-v2-selected" : ""}`} title={badge.name}>
                    <img src={badge.src} alt="" loading="lazy" />
                    <span>{badge.name}</span>
                    <input type="checkbox" checked={selected.has(badge.id)} onChange={() => toggle(badge.id)} aria-label={`Show ${badge.name} locally`} />
                    <i aria-hidden="true" />
                </label>)}
                {filtered.length === 0 && <div className="dc-v2-no-results">No matching badges.</div>}
            </div>
        </div>
    );
}
