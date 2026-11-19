/*
 * DraxxCord Game Activity v7
 * Integrated local Rich Presence controller for Vencord desktop.
 * Only uses Discord's normal detectable-game catalog and LOCAL_ACTIVITY_UPDATE.
 * Does not execute games, send messages, access credentials or fake Discord badges.
 * Original work, GPL-3.0-or-later; integration pattern informed by Vencord CustomRPC.
 */
import { Settings } from "@api/Settings";
import { FluxDispatcher, React, RestAPI } from "@webpack/common";

import "./draxx-game-activity.css";

type Game = { id: string; name: string; cover?: string; icon?: string; windows: boolean; };
type Saved = { enabled: boolean; resumeOnRestart: boolean; game?: Game; details: string; state: string; startedAt?: number; };
const STORE_KEY = "DraxxCordGameActivityV7";
const SOCKET_ID = "DraxxCordGameActivityV7";
const defaultSaved: Saved = { enabled: false, resumeOnRestart: false, details: "", state: "" };
let catalog: Game[] = [];
let catalogPromise: Promise<Game[]> | undefined;
let active = false;
let status = "Choose a game from Discord's catalog.";
const listeners = new Set<() => void>();
const notify = () => { for (const listener of [...listeners]) listener(); };

function readSaved(): Saved {
    try {
        // Vencord Settings persist across Discord restarts; no localStorage dependency.
        const plugins = Settings.plugins as Record<string, any>;
        const value = plugins[STORE_KEY] as Partial<Saved> | undefined;
        return { ...defaultSaved, ...(value && typeof value === "object" ? value : {}) };
    } catch { return { ...defaultSaved }; }
}
function writeSaved(patch: Partial<Saved>) {
    const previous = readSaved();
    const next = { ...previous, ...patch };
    (Settings.plugins as Record<string, any>)[STORE_KEY] = next;
    notify();
}
function imageUrl(id: string, value: unknown): string | undefined {
    if (typeof value !== "string" || !/^[\w-]{1,128}$/.test(value)) return;
    return `https://cdn.discordapp.com/app-icons/${id}/${value}.png?size=256`;
}
function normalizeCatalog(body: unknown): Game[] {
    if (!Array.isArray(body)) {
        const container = body as { applications?: unknown; games?: unknown; } | null;
        body = container?.applications ?? container?.games;
    }
    if (!Array.isArray(body)) throw new Error("Discord returned an unexpected catalog format.");
    const unique = new Map<string, Game>();
    for (const raw of body) {
        if (!raw || typeof raw !== "object") continue;
        const obj = raw as Record<string, any>;
        if (typeof obj.id !== "string" || !/^\d{5,22}$/.test(obj.id) || typeof obj.name !== "string") continue;
        // The endpoint itself is Discord's detectable APPLICATION catalog.
        // Keep every valid entry (including macOS/Linux and unusual clients) instead of
        // silently dropping games with no win32 executable or launcher-only metadata.
        // IDs are supplied by Discord; none are guessed or generated.
        const executables = Array.isArray(obj.executables) ? obj.executables : [];
        const windows = executables.some((x: any) => x?.os === "win32");
        const cover = imageUrl(obj.id, obj.cover_image_hash ?? obj.cover_image ?? obj.coverImage);
        const icon = imageUrl(obj.id, obj.icon_hash ?? obj.icon);
        unique.set(obj.id, { id: obj.id, name: obj.name.trim(), cover, icon, windows });
    }
    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}
async function loadCatalog(): Promise<Game[]> {
    if (catalog.length) return catalog;
    if (catalogPromise) return catalogPromise;
    catalogPromise = (async () => {
        let response: { body: unknown; };
        try {
            response = await RestAPI.get({ url: "/applications/detectable", retries: 0 });
        } catch (e) {
            const err = e as { status?: number; statusCode?: number; };
            if ((err?.status ?? err?.statusCode) !== 404) throw e;
            response = await RestAPI.get({ url: "/games/detectable", retries: 0 });
        }
        const games = normalizeCatalog(response.body);
        if (!games.length) throw new Error("Discord returned no detectable games.");
        catalog = games;
        return games;
    })();
    try { return await catalogPromise; } finally { catalogPromise = undefined; }
}
function publish(saved: Saved) {
    if (!saved.game || !/^\d{5,22}$/.test(saved.game.id)) throw new Error("Choose a valid game.");
    // This is how Vencord's official CustomRPC plugin publishes a real local presence.
    // Discord may not show it to others if Activity Sharing is disabled.
    FluxDispatcher.dispatch({
        type: "LOCAL_ACTIVITY_UPDATE", socketId: SOCKET_ID,
        activity: {
            application_id: saved.game.id,
            name: saved.game.name,
            type: 0, flags: 1,
            ...(saved.details.trim() ? { details: saved.details.trim().slice(0, 128) } : {}),
            ...(saved.state.trim() ? { state: saved.state.trim().slice(0, 128) } : {}),
            timestamps: { start: saved.startedAt || Date.now() }
        }
    });
    active = true;
    status = `Playing ${saved.game.name} — activity sent to Discord.`;
    notify();
}
export function startDraxxGameActivity(game: Game, details: string, state: string) {
    const saved: Saved = { ...readSaved(), enabled: true, game, details, state, startedAt: Date.now() };
    publish(saved);
    writeSaved(saved);
}
export function stopDraxxGameActivity(clearSaved = true) {
    try { FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", socketId: SOCKET_ID, activity: null }); }
    catch (e) { console.warn("[DraxxCord Game Activity] Could not clear activity", e); }
    active = false;
    status = "Stopped — your normal activity is unaffected.";
    if (clearSaved) writeSaved({ enabled: false });
    notify();
}
export function restoreDraxxGameActivity() {
    const saved = readSaved();
    if (!saved.enabled || !saved.resumeOnRestart || !saved.game) return;
    try { publish({ ...saved, startedAt: Date.now() }); }
    catch (e) { console.warn("[DraxxCord Game Activity] Restore failed", e); }
}


// Names below are discovery shortcuts, not fabricated application IDs.
// We only expose selectable activities after resolving their actual Discord catalog entry.
const GAME_GROUPS: Record<string, string[]> = {
    "POPULAR": [
        "VALORANT", "Fortnite", "Minecraft", "Grand Theft Auto V", "FiveM", "Roblox", "Counter-Strike 2", "League of Legends",
        "Rocket League", "Apex Legends", "Overwatch 2", "Call of Duty", "PUBG: BATTLEGROUNDS", "Dota 2", "Rainbow Six Siege",
        "Genshin Impact", "Honkai: Star Rail", "Brawlhalla", "osu!", "Dead by Daylight", "Phasmophobia", "Among Us", "The Sims 4", "Terraria"
    ],
    "SHOOTERS": [
        "VALORANT", "Counter-Strike 2", "Apex Legends", "Fortnite", "Overwatch 2", "Call of Duty", "PUBG: BATTLEGROUNDS",
        "Tom Clancy's Rainbow Six Siege", "THE FINALS", "Escape from Tarkov", "Warframe", "Destiny 2", "Battlefield 2042", "Battlefield 6",
        "Team Fortress 2", "Paladins", "Marvel Rivals", "Rust", "DOOM Eternal", "Helldivers 2", "War Thunder", "Warface"
    ],
    "OPEN WORLD": [
        "Grand Theft Auto V", "FiveM", "Red Dead Redemption 2", "Cyberpunk 2077", "Elden Ring", "Hogwarts Legacy", "The Witcher 3",
        "ARK: Survival Evolved", "ARK: Survival Ascended", "No Man's Sky", "Subnautica", "Subnautica: Below Zero", "Sons Of The Forest",
        "The Forest", "Palworld", "Minecraft", "Garry's Mod", "Starfield", "Assassin's Creed Valhalla", "Watch Dogs 2", "Far Cry 6"
    ],
    "HORROR": [
        "Resident Evil 4", "Resident Evil 2", "Resident Evil Village", "Resident Evil 7 Biohazard", "Dead by Daylight",
        "Phasmophobia", "Lethal Company", "Content Warning", "Outlast", "The Outlast Trials", "Until Dawn", "SILENT HILL 2",
        "Five Nights at Freddy's", "Amnesia: The Bunker", "Little Nightmares", "Little Nightmares II", "Dead Space", "Dying Light 2"
    ],
    "SPORTS": [
        "EA SPORTS FC 26", "EA SPORTS FC 25", "EA SPORTS FC 24", "FIFA 23", "Rocket League", "NBA 2K26", "NBA 2K25",
        "Forza Horizon 5", "Forza Horizon 4", "Assetto Corsa", "Assetto Corsa Competizione", "F1 25", "F1 24", "eFootball",
        "WWE 2K25", "Trackmania", "Need for Speed Heat", "Need for Speed Unbound", "CarX Drift Racing Online"
    ],
    "RPG / ANIME": [
        "Elden Ring", "Dark Souls III", "Sekiro: Shadows Die Twice", "Black Myth: Wukong", "Baldur's Gate 3", "Monster Hunter Wilds",
        "Monster Hunter: World", "Genshin Impact", "Honkai: Star Rail", "Zenless Zone Zero", "Wuthering Waves", "Persona 5 Royal",
        "Persona 3 Reload", "Dragon Ball: Sparking! ZERO", "DRAGON BALL Z: KAKAROT", "NARUTO SHIPPUDEN: Ultimate Ninja STORM 4",
        "Devil May Cry 5", "NieR:Automata", "Final Fantasy XIV", "FINAL FANTASY VII REMAKE INTERGRADE", "Crimson Desert"
    ],
    "INDIE / CO-OP": [
        "Stardew Valley", "Hollow Knight", "Hades", "Hades II", "Celeste", "Cuphead", "Undertale", "Deltarune", "Terraria",
        "Don't Starve Together", "Human: Fall Flat", "It Takes Two", "A Way Out", "Overcooked! 2", "PEAK", "R.E.P.O.",
        "Lethal Company", "Content Warning", "Among Us", "Goose Goose Duck", "Geometry Dash", "osu!", "Slay the Spire", "Vampire Survivors"
    ],
    "RACING": [
        "Forza Horizon 5", "Forza Horizon 4", "Forza Motorsport", "Assetto Corsa", "Assetto Corsa Competizione", "iRacing",
        "F1 25", "F1 24", "F1 23", "EA SPORTS WRC", "DiRT Rally 2.0", "The Crew Motorfest", "The Crew 2",
        "Need for Speed Unbound", "Need for Speed Heat", "Need for Speed Payback", "Need for Speed Most Wanted",
        "BeamNG.drive", "Euro Truck Simulator 2", "American Truck Simulator", "CarX Drift Racing Online", "Trackmania",
        "GRID Legends", "Wreckfest", "MotoGP 25", "RIDE 5", "Burnout Paradise Remastered", "Gran Turismo 7"
    ],
    "STRATEGY": [
        "Age of Empires II: Definitive Edition", "Age of Empires IV", "Civilization VI", "Sid Meier's Civilization VII",
        "Stellaris", "Crusader Kings III", "Hearts of Iron IV", "Europa Universalis IV", "Total War: WARHAMMER III",
        "Total War: THREE KINGDOMS", "XCOM 2", "RimWorld", "Factorio", "Satisfactory", "Against the Storm",
        "Frostpunk", "Frostpunk 2", "They Are Billions", "Northgard", "Dune: Spice Wars", "Company of Heroes 3",
        "Command & Conquer Remastered Collection", "Warcraft III: Reforged", "StarCraft II", "Bloons TD 6", "Plague Inc: Evolved"
    ],
    "SIMULATION": [
        "The Sims 4", "Cities: Skylines", "Cities: Skylines II", "Microsoft Flight Simulator", "Microsoft Flight Simulator 2024",
        "Farming Simulator 25", "Farming Simulator 22", "House Flipper", "House Flipper 2", "PowerWash Simulator", "Planet Coaster",
        "Planet Coaster 2", "Planet Zoo", "Two Point Hospital", "Two Point Campus", "Cooking Simulator", "Gas Station Simulator",
        "Supermarket Simulator", "PC Building Simulator", "PC Building Simulator 2", "Kerbal Space Program", "Kerbal Space Program 2",
        "Car Mechanic Simulator 2021", "Fishing Planet", "Slime Rancher", "Slime Rancher 2"
    ],
    "FIGHTING": [
        "TEKKEN 8", "Tekken 7", "Street Fighter 6", "Street Fighter V", "Mortal Kombat 1", "Mortal Kombat 11",
        "Dragon Ball: Sparking! ZERO", "DRAGON BALL FighterZ", "Super Smash Bros. Ultimate", "Guilty Gear -Strive-",
        "Granblue Fantasy Versus: Rising", "Brawlhalla", "MultiVersus", "Injustice 2", "NARUTO SHIPPUDEN: Ultimate Ninja STORM 4",
        "NARUTO X BORUTO Ultimate Ninja STORM CONNECTIONS", "Soulcalibur VI", "Dead or Alive 6", "Killer Instinct", "For Honor"
    ],
    "MMO / ONLINE": [
        "World of Warcraft", "World of Warcraft Classic", "FINAL FANTASY XIV", "The Elder Scrolls Online", "Lost Ark", "Black Desert",
        "New World", "Guild Wars 2", "Old School RuneScape", "RuneScape", "Albion Online", "MapleStory", "Tower of Fantasy",
        "Warframe", "Destiny 2", "EVE Online", "Trove", "Diablo IV", "Path of Exile", "Path of Exile 2",
        "Throne and Liberty", "Dofus", "Wakfu", "Tibia", "TERA", "Neverwinter", "Star Wars: The Old Republic"
    ],
    "SURVIVAL": [
        "Minecraft", "Terraria", "Rust", "7 Days to Die", "DayZ", "Project Zomboid", "The Forest", "Sons Of The Forest",
        "Green Hell", "Subnautica", "Subnautica: Below Zero", "Raft", "Valheim", "Enshrouded", "V Rising", "Palworld",
        "ARK: Survival Evolved", "ARK: Survival Ascended", "Conan Exiles", "Grounded", "Grounded 2", "Abiotic Factor",
        "No Man's Sky", "The Long Dark", "Don't Starve Together", "Once Human", "State of Decay 2"
    ],
    "CLASSICS": [
        "Half-Life", "Half-Life 2", "Portal", "Portal 2", "Left 4 Dead 2", "Team Fortress 2", "Garry's Mod",
        "Grand Theft Auto: San Andreas", "Grand Theft Auto IV", "Grand Theft Auto: Vice City", "Counter-Strike: Source",
        "Counter-Strike 1.6", "Call of Duty 4: Modern Warfare", "Call of Duty: Black Ops II", "BioShock",
        "BioShock Infinite", "Borderlands 2", "The Elder Scrolls V: Skyrim", "Fallout: New Vegas", "Fallout 4",
        "Mass Effect Legendary Edition", "Dark Souls III", "The Binding of Isaac: Rebirth", "Plants vs. Zombies GOTY Edition",
        "The Walking Dead", "Undertale", "Papers, Please", "Geometry Dash", "Hotline Miami", "Hotline Miami 2: Wrong Number"
    ]
};
const CATEGORIES = ["ALL GAMES", "POPULAR", "SHOOTERS", "OPEN WORLD", "HORROR", "SPORTS", "RPG / ANIME", "INDIE / CO-OP", "RACING", "STRATEGY", "SIMULATION", "FIGHTING", "MMO / ONLINE", "SURVIVAL", "CLASSICS"];
const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
function resolvePresets(group: string, games: Game[]): Game[] {
    const wanted = GAME_GROUPS[group] || [];
    const matches: Game[] = [];
    const seen = new Set<string>();
    const byName = new Map(games.map(game => [normalizeName(game.name), game]));
    for (const label of wanted) {
        const key = normalizeName(label);
        const exact = byName.get(key);
        const match = exact || games.find(game => normalizeName(game.name).startsWith(key + " "));
        if (match && !seen.has(match.id)) { seen.add(match.id); matches.push(match); }
    }
    return matches;
}
function iconSrc(game: Game): string | undefined { return game.icon || game.cover; }

export function DraxxGameActivity() {
    const [, forceRender] = React.useReducer((n: number) => n + 1, 0);
    const [games, setGames] = React.useState<Game[]>(catalog);
    const [search, setSearch] = React.useState("");
    const [category, setCategory] = React.useState("ALL GAMES");
    const [windowsOnly, setWindowsOnly] = React.useState(false);
    const [sortDescending, setSortDescending] = React.useState(false);
    const [page, setPage] = React.useState(0);
    const [pageSize, setPageSize] = React.useState(80);
    const [details, setDetails] = React.useState(() => readSaved().details);
    const [state, setState] = React.useState(() => readSaved().state);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");
    const [resume, setResume] = React.useState(() => readSaved().resumeOnRestart);
    const libraryRef = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => { listeners.add(forceRender); return () => { listeners.delete(forceRender); }; }, []);
    React.useEffect(() => {
        if (games.length) return;
        let cancelled = false;
        setBusy(true);
        void loadCatalog().then(found => { if (!cancelled) setGames(found); })
            .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load Discord's games."); })
            .finally(() => { if (!cancelled) setBusy(false); });
        return () => { cancelled = true; };
    }, []);
    const saved = readSaved();
    const q = normalizeName(search);
    // Unlike v7.2, no .slice(0,120) limit on the searchable catalog.
    // Only the currently visible page is rendered to keep Discord responsive.
    const filtered = React.useMemo(() => {
        const pool = category === "ALL GAMES" || q ? games : resolvePresets(category, games);
        const result = pool.filter(game => (!windowsOnly || game.windows) && (!q || normalizeName(game.name).includes(q)));
        return sortDescending ? result.reverse() : result;
    }, [games, category, q, windowsOnly, sortDescending]);
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, pages - 1);
    const visible = React.useMemo(() => filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize), [filtered, currentPage, pageSize]);
    const returnToTop = () => { if (libraryRef.current) libraryRef.current.scrollTop = 0; };
    function changePage(next: number) { setPage(Math.max(0, Math.min(pages - 1, next))); returnToTop(); }
    function setFilter(text: string) { setSearch(text); setPage(0); returnToTop(); }
    function setGroup(group: string) { setCategory(group); setSearch(""); setPage(0); returnToTop(); }
    function toggle(game: Game) {
        try {
            if (active && saved.game?.id === game.id) stopDraxxGameActivity(true);
            else startDraxxGameActivity(game, details, state);
            setError("");
            forceRender();
        } catch (e) { setError(e instanceof Error ? e.message : "Unable to send the activity."); }
    }
    async function refresh() {
        setBusy(true); setError(""); setPage(0);
        catalog = []; catalogPromise = undefined;
        try { setGames(await loadCatalog()); }
        catch (e) { setError(e instanceof Error ? e.message : "Catalog unavailable."); }
        finally { setBusy(false); }
    }
    function updateActive() {
        if (!saved.game || !active) return;
        try { startDraxxGameActivity(saved.game, details, state); setError(""); }
        catch (e) { setError(e instanceof Error ? e.message : "Unable to update activity."); }
    }
    return <div className="draxx-game-panel draxx-library-v72 draxx-library-v73">
        <div className="draxx-game-top"><strong>GAME ACTIVITY — MAX LIBRARY</strong><small>DRAXXCORD · V7.3</small></div>
        <p className="draxx-game-hint">Browse every title returned by Discord's detectable applications catalog. Select a game and switch it ON like a Badge; selecting another switches the active game.</p>
        <div className="draxx-game-state"><span className={active ? "draxx-ga-online" : "draxx-ga-idle"}>{active ? "● ACTIVE" : "○ OFF"}</span> <span>{active ? saved.game?.name : "No custom game active"}</span></div>
        <div className="draxx-ga-search"><input className="draxx-game-input" type="search" placeholder="Search ALL Discord game titles..." value={search} onChange={e => setFilter(e.currentTarget.value)} />
            <button type="button" onClick={() => void refresh()} disabled={busy} title="Refresh Discord detectable games">↻</button></div>
        <div className="draxx-ga-category-tabs" aria-label="Game categories">
            {CATEGORIES.map(name => <button type="button" key={name} className={category === name ? "selected" : ""}
                onClick={() => setGroup(name)}>{name}</button>)}
        </div>
        <div className="draxx-ga-filters">
            <label className="draxx-game-check"><input type="checkbox" checked={windowsOnly} onChange={e => { setWindowsOnly(e.currentTarget.checked); setPage(0); }} /> Windows games only</label>
            <button type="button" onClick={() => { setSortDescending(p => !p); setPage(0); }}>{sortDescending ? "Sort: Z → A" : "Sort: A → Z"}</button>
            <select aria-label="Games per page" value={pageSize} onChange={e => { setPageSize(Number(e.currentTarget.value)); setPage(0); }}>
                <option value={40}>40/page</option><option value={80}>80/page</option><option value={150}>150/page</option>
            </select>
        </div>
        {error && <p className="draxx-game-error">{error}</p>}
        <div className="draxx-ga-count">{busy ? "Loading Discord game catalog…" : `${filtered.length.toLocaleString()} matching · ${games.length.toLocaleString()} total games · page ${currentPage + 1} of ${pages.toLocaleString()}`}</div>
        <div className="draxx-ga-library" ref={libraryRef} aria-label="Full searchable Discord game activity catalog">
            {visible.map(game => {
                const on = active && saved.game?.id === game.id;
                return <div className={`draxx-ga-game${on ? " draxx-ga-active" : ""}`} key={game.id}>
                    {iconSrc(game) ? <img src={iconSrc(game)} alt="" loading="lazy" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
                        : <span className="draxx-ga-game-placeholder">🎮</span>}
                    <div className="draxx-ga-name" title={game.name}>{game.name}</div>
                    <button type="button" className={`draxx-ga-toggle ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggle(game)}>{on ? "ON" : "OFF"}</button>
                </div>;
            })}
            {!busy && !filtered.length && <p className="draxx-game-hint">{games.length ? "No matching Discord catalog games. Try ALL GAMES, or disable Windows-only filter." : "No games loaded. Click ↻ to retry."}</p>}
        </div>
        {filtered.length > pageSize && <div className="draxx-ga-pagination">
            <button type="button" disabled={currentPage === 0} onClick={() => changePage(0)}>«</button>
            <button type="button" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Prev</button>
            <span>{currentPage + 1} / {pages.toLocaleString()}</span>
            <button type="button" disabled={currentPage >= pages - 1} onClick={() => changePage(currentPage + 1)}>Next</button>
            <button type="button" disabled={currentPage >= pages - 1} onClick={() => changePage(pages - 1)}>»</button>
        </div>}
        <div className="draxx-ga-config">
            <strong>ACTIVITY OPTIONS</strong>
            <label>Details<input className="draxx-game-input" value={details} onChange={e => setDetails(e.currentTarget.value)} maxLength={128} placeholder="In a match" /></label>
            <label>State<input className="draxx-game-input" value={state} onChange={e => setState(e.currentTarget.value)} maxLength={128} placeholder="Competitive / Ranked" /></label>
            <button type="button" className="draxx-ga-apply" disabled={!active || !saved.game} onClick={updateActive}>Update active game details</button>
            <label className="draxx-game-check"><input type="checkbox" checked={resume} onChange={e => { setResume(e.currentTarget.checked); writeSaved({ resumeOnRestart: e.currentTarget.checked }); }} /> Restore chosen game after Discord restart</label>
            <button type="button" className="draxx-ga-stop" onClick={() => stopDraxxGameActivity(true)}>Stop custom game activity</button>
        </div>
        <p className="draxx-game-hint">The library is live, not a fixed list: only applications Discord's catalog returns are selectable. This is local Rich Presence publishing, not game execution, Quest completion or an official badge. Images and visibility depend on Discord.</p>
    </div>;
}
