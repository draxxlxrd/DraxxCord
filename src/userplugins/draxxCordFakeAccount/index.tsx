/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * DraxxCord FakeAccount — native switcher integration.
 * Based on the user-provided b4lCord fakeAccount source (MultiAccountStore approach).
 * Replaces the previous DOM-injected fake menu group, not a real account switch.
 * Only PUBLIC user display data is persisted; never accesses auth tokens.
 */

import * as DataStore from "@api/DataStore";
import definePlugin from "@utils/types";
import { findStoreLazy, waitFor } from "@webpack";
import { Menu, UserStore } from "@webpack/common";

import "./style.css";

interface FakeEntry {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string;
    avatar?: string | null;
    discriminator?: string;
}

const DATA_KEY = "draxxcord-fake-switcher-local-v1"; // preserve previous fake accounts
const PANEL_CLASS = "vc-draxxcord-native-fake-panel";
const PANEL_HOST_CLASS = "vc-draxxcord-native-fake-host";

let entries: FakeEntry[] = [];
let selectedId: string | null = null;
let running = false;
let accountStore: any = null;
let originalUsers: any;
let originalValidUsers: any;
let originalHasLoggedIn: any;
let storePatched = false;
let observer: MutationObserver | null = null;
let scheduled = false;

const norm = (s?: string | null) => String(s ?? "").toLocaleLowerCase().trim();
const nameOf = (user: any) => String(user?.globalName || user?.global_name || user?.username || user?.id || "Unknown");

function getAvatarUrl(user: any): string {
    try { return String(user.getAvatarURL?.(undefined, 64, true) || ""); }
    catch { return ""; }
}

function snapshot(user: any): FakeEntry {
    return {
        id: String(user.id),
        username: String(user.username || user.id),
        displayName: nameOf(user),
        avatarUrl: getAvatarUrl(user),
        avatar: user.avatar ?? null,
        discriminator: user.discriminator ?? "0",
    };
}

function save() {
    // Only public profile display data; no auth store, tokens or session fields.
    void Promise.resolve(DataStore.set(DATA_KEY, entries)).catch(() => {});
}

function getRealAccounts(): any[] {
    if (!accountStore || !originalUsers) return [];
    try {
        const result = originalUsers.call(accountStore);
        return Array.isArray(result) ? result : [];
    } catch { return []; }
}

function fakeStoreEntry(fake: FakeEntry) {
    // The original b4lCord plugin used exactly this shape to let Discord draw
    // fake users using the native Switch Accounts menu components.
    const current = UserStore.getUser(fake.id) as any;
    return {
        id: fake.id,
        username: fake.username,
        globalName: fake.displayName,
        discriminator: fake.discriminator ?? "0",
        avatar: fake.avatar ?? current?.avatar ?? null,
        tokenStatus: 2,
        pushSyncToken: null,
    };
}

function mergeAccounts(realAccounts: any[]): any[] {
    const originals = new Set(realAccounts.map(a => String(a?.id)));
    return [
        ...realAccounts,
        ...entries.filter(fake => !originals.has(fake.id)).map(fakeStoreEntry),
    ];
}

function notifyStore() {
    try { accountStore?.emitChange?.(); } catch { /* unstable Discord store */ }
}

function isMultiAccountStore(mod: any): boolean {
    try {
        if (!mod || typeof mod.getUsers !== "function" || typeof mod.getValidUsers !== "function") return false;
        if (typeof mod.getHasLoggedInAccounts !== "function") return false;
        if (typeof mod.getFrequentlyUsedEmojis === "function") return false;
        const value = mod.getUsers();
        if (!Array.isArray(value)) return false;
        if (value.length && (typeof value[0]?.id !== "string" || typeof value[0] !== "object")) return false;
        return true;
    } catch { return false; }
}

function patchNativeStore(mod: any) {
    if (!running || storePatched || !isMultiAccountStore(mod)) return;
    accountStore = mod;
    originalUsers = mod.getUsers;
    originalValidUsers = mod.getValidUsers;
    originalHasLoggedIn = mod.getHasLoggedInAccounts;
    try {
        mod.getUsers = function (...args: any[]) {
            const value = originalUsers.apply(this, args);
            return Array.isArray(value) ? mergeAccounts(value) : value;
        };
        mod.getValidUsers = function (...args: any[]) {
            const value = originalValidUsers.apply(this, args);
            return Array.isArray(value) ? mergeAccounts(value) : value;
        };
        mod.getHasLoggedInAccounts = function (...args: any[]) {
            return entries.length > 0 || originalHasLoggedIn.apply(this, args);
        };
        storePatched = true;
        notifyStore();
    } catch {
        unpatchNativeStore();
    }
}

function unpatchNativeStore() {
    if (!accountStore) return;
    try {
        if (originalUsers) accountStore.getUsers = originalUsers;
        if (originalValidUsers) accountStore.getValidUsers = originalValidUsers;
        if (originalHasLoggedIn) accountStore.getHasLoggedInAccounts = originalHasLoggedIn;
        notifyStore();
    } catch { /* Discord changed the store */ }
    accountStore = null;
    originalUsers = originalValidUsers = originalHasLoggedIn = null;
    storePatched = false;
}

function addFake(user: any) {
    if (!user?.id || user.id === UserStore.getCurrentUser()?.id) return;
    const next = snapshot(user);
    const index = entries.findIndex(e => e.id === next.id);
    if (index >= 0) entries[index] = next;
    else entries.push(next);
    save();
    notifyStore();
}

function removeFake(id: string) {
    entries = entries.filter(e => e.id !== id);
    if (selectedId === id) selectedId = null;
    save();
    notifyStore();
    queueRefresh();
}

function clearPanel() {
    document.querySelectorAll<HTMLElement>(`.${PANEL_CLASS}`).forEach(element => element.remove());
    document.querySelectorAll<HTMLElement>(`.${PANEL_HOST_CLASS}`).forEach(element => element.classList.remove(PANEL_HOST_CLASS));
}

function selectFake(id: string) {
    if (!entries.some(entry => entry.id === id)) return;
    selectedId = id;
    queueRefresh();
}

function renderPanel() {
    if (!running || !selectedId) { clearPanel(); return; }
    const fake = entries.find(e => e.id === selectedId);
    if (!fake) { clearPanel(); return; }
    const panels = document.querySelector<HTMLElement>('[class*="panels_"]');
    const host = panels?.querySelector<HTMLElement>('[class*="avatarWrapper_"]');
    if (!host) return;
    const existing = host.querySelector<HTMLElement>(`.${PANEL_CLASS}`);
    if (existing?.dataset.fakeId === fake.id) return;
    clearPanel();
    host.classList.add(PANEL_HOST_CLASS);
    const wrap = document.createElement("div");
    wrap.className = PANEL_CLASS;
    wrap.dataset.fakeId = fake.id;
    const img = document.createElement("img");
    img.alt = "";
    img.className = "vc-draxxcord-native-fake-avatar";
    if (fake.avatarUrl) img.src = fake.avatarUrl;
    const names = document.createElement("span");
    names.className = "vc-draxxcord-native-fake-names";
    const title = document.createElement("span");
    title.textContent = fake.displayName;
    title.className = "vc-draxxcord-native-fake-title";
    const subtitle = document.createElement("span");
    subtitle.textContent = fake.username;
    subtitle.className = "vc-draxxcord-native-fake-subtitle";
    names.append(title, subtitle);
    wrap.append(img, names);
    host.append(wrap);
}

function queueRefresh() {
    if (!running || scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        scheduled = false;
        if (running) renderPanel();
    });
}

// Fake accounts are shown by Discord's own account menu. Prevent clicks on
// those public-profile entries from invoking a REAL account-switch action.
// The match is conservative: skip ambiguous rows and known real accounts.
function findClickedFake(target: EventTarget | null): FakeEntry | null {
    if (!(target instanceof Element) || !accountStore) return null;
    const row = target.closest<HTMLElement>('[role^="menuitem"]');
    if (!row) return null;
    const menu = row.closest<HTMLElement>('[role="menu"]');
    if (!menu || !norm(menu.textContent).includes("manage accounts")) return null;
    const text = norm(row.textContent);
    const real = getRealAccounts();
    const matches = entries.filter(fake => {
        if (real.some(a => a.id === fake.id)) return false;
        // Native Discord menu generally displays the account username.
        if (norm(fake.username) && text.includes(norm(fake.username))) return true;
        if (norm(fake.displayName) && text.includes(norm(fake.displayName))) return true;
        return false;
    });
    if (matches.length !== 1) return null;
    const fake = matches[0];
    if (real.some(a => norm(a.username) === norm(fake.username) || norm(a.globalName) === norm(fake.displayName))) return null;
    return fake;
}

function stopAndSelect(e: Event) {
    const fake = findClickedFake(e.target);
    if (!fake) {
        // Let Discord handle real account entries normally; clear our visual
        // preview when the current real account is chosen.
        if (selectedId && e.target instanceof Element) {
            const row = e.target.closest<HTMLElement>('[role^="menuitem"]');
            const menu = row?.closest<HTMLElement>('[role="menu"]');
            if (row && menu && norm(menu.textContent).includes("manage accounts")) {
                const me = UserStore.getCurrentUser() as any;
                const text = norm(row.textContent);
                if (me && (text.includes(norm(me.username)) || (me.globalName && text.includes(norm(me.globalName))))) {
                    selectedId = null;
                    queueRefresh();
                }
            }
        }
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    selectFake(fake.id);
}
function captureKey(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") stopAndSelect(e);
}

function onUserContext(children: any[], props: any) {
    const user = props?.user;
    if (!user?.id || user.id === UserStore.getCurrentUser()?.id) return;
    const exists = entries.some(e => e.id === String(user.id));
    children.push(
        <Menu.MenuItem
            id="draxxcord-native-fake-toggle"
            label={exists ? "Remove from Fake Switcher" : "Add to Fake Switcher"}
            action={() => exists ? removeFake(String(user.id)) : addFake(user)}
        />
    );
}

export default definePlugin({
    name: "DraxxCord FakeAccount",
    description: "Adds fake accounts as normal rows in Discord Switch Accounts. Local visual only, no account sign-in or tokens.",
    authors: [{ name: "DraxxCord port (b4lCord original credited in source)", id: 0n }],
    contextMenus: {
        "user-context": onUserContext,
        "user-profile-actions": onUserContext,
    },
    async start() {
        running = true;
        // Remove stale elements from earlier DOM-injection versions.
        document.querySelectorAll<HTMLElement>('.vc-draxxcord-fake-group, .vc-draxxcord-fake-switcher-entry, .vc-draxxcord-fake-heading, .vc-draxxcord-fake-panel').forEach(n => n.remove());
        try {
            const stored = await DataStore.get(DATA_KEY);
            if (!running) return;
            if (Array.isArray(stored)) entries = stored.filter((e: any) => e && typeof e.id === "string" && typeof e.username === "string")
                .slice(0, 30).map((e: any) => ({
                    id: e.id,
                    username: e.username,
                    displayName: String(e.displayName || e.username),
                    avatarUrl: String(e.avatarUrl || ""),
                    avatar: typeof e.avatar === "string" ? e.avatar : null,
                    discriminator: String(e.discriminator ?? "0"),
                }));
        } catch { /* no stored fake accounts */ }
        if (!running) return;
        document.addEventListener("click", stopAndSelect, true);
        document.addEventListener("keydown", captureKey, true);
        observer = new MutationObserver(queueRefresh);
        observer.observe(document.body, { childList: true, subtree: true });
        // Prefer the exact Flux store name; fall back to the original b4lCord
        // method fingerprint when Discord exports the store differently.
        try {
            const namedStore = findStoreLazy("MultiAccountStore") as any;
            if (isMultiAccountStore(namedStore)) patchNativeStore(namedStore);
        } catch { /* not yet loaded */ }
        waitFor(["getUsers", "getValidUsers", "getHasLoggedInAccounts"], (mod: any) => {
            if (running) patchNativeStore(mod);
        });
        queueRefresh();
    },
    stop() {
        running = false;
        document.removeEventListener("click", stopAndSelect, true);
        document.removeEventListener("keydown", captureKey, true);
        observer?.disconnect();
        observer = null;
        unpatchNativeStore();
        selectedId = null;
        clearPanel();
        entries = [];
    },
});
