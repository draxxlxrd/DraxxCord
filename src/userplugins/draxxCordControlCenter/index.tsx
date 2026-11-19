/*
 * DraxxCord Control Center v2.8
 * User plugin for Vencord. GPL-3.0-or-later.
 * Separate settings sidebar entry, without modifying Vencord core or DraxPanel.
 */
import "./styles.css";
import { definePluginSettings, Settings } from "@api/Settings";
import { isPluginEnabled, pluginRequiresRestart, startDependenciesRecursive, startPlugin, stopPlugin } from "@api/PluginManager";
import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot, ModalSize, openModal } from "@utils/modal";
import SettingsPlugin from "@plugins/_core/settings";
import definePlugin, { OptionType, type IconProps } from "@utils/types";
import { React } from "@webpack/common";
import plugins from "~plugins";

const LOGO = "data:image/png;base64,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";
type Language = "en" | "ar" | "fr" | "es" | "de";
type Page = "home" | "modules" | "appearance" | "quick" | "diagnostics";
const translations = {
    en: {"control": "CONTROL CENTER", "language": "Language", "home": "Home", "modules": "Modules", "appearance": "Appearance", "intro": "SILVER INTERFACE", "tagline": "Your DraxxCord space. Clean, fast, and easy to use.", "version": "v2.8", "manage": "Manage plugins", "quick": "QUICK ACCESS", "motion": "3D Hover", "motionDesc": "Subtle movement when hovering over cards and buttons.", "langDesc": "Pick the language for this page.", "settings": "PREFERENCES", "enabled": "On", "disabled": "Off", "pluginsFound": "Plugins detected", "pluginsEnabled": "Enabled plugins", "active": "Client preview active", "details": "This page is a separate DraxxCord settings entry. No other plugin files were changed.", "modulesTitle": "YOUR MODULES", "modulesDesc": "Quick access to the plugins you already have.", "pluginsAction": "Browse plugin settings", "themeTitle": "LOOK & FEEL", "themeDesc": "Make it yours without touching your other themes.", "reduceMotion": "Animation is disabled in your system accessibility settings.", "configSaved": "Changes are saved by Vencord.", "ready": "Ready"},
    ar: {"control": "لوحة التحكم", "language": "اللغة", "home": "الرئيسية", "modules": "الإضافات", "appearance": "المظهر", "intro": "واجهة فضية", "tagline": "كل أدوات DraxxCord في مكان واحد، وبشكل مرتب.", "version": "الإصدار v2.8", "manage": "إدارة الإضافات", "quick": "وصول سريع", "motion": "حركة ثلاثية الأبعاد", "motionDesc": "حركة خفيفة للبطاقات والأزرار لما تمرر عليها المؤشر.", "langDesc": "اختار اللغة اللي تريحك.", "settings": "الإعدادات", "enabled": "مفعّل", "disabled": "موقف", "pluginsFound": "الإضافات الموجودة", "pluginsEnabled": "الإضافات المفعّلة", "active": "الواجهة شغالة", "details": "هذي صفحة خاصة بـ DraxxCord. باقي الإضافات ما تبدّل فيها شيء.", "modulesTitle": "إضافاتك", "modulesDesc": "ادخل بسرعة للإضافات اللي تستعملها.", "pluginsAction": "إعدادات الإضافات", "themeTitle": "الشكل والحركة", "themeDesc": "غيّر المظهر بدون ما تمس باقي الثيمات.", "reduceMotion": "النظام عندك موقف الحركات من إعدادات سهولة الوصول.", "configSaved": "الإعدادات تنحفظ تلقائياً.", "ready": "جاهز"},
    fr: {"control": "CENTRE DE CONTRÔLE", "language": "Langue", "home": "Accueil", "modules": "Modules", "appearance": "Apparence", "intro": "INTERFACE ARGENTÉE", "tagline": "Votre espace DraxxCord, simple et bien organisé.", "version": "v2.8", "manage": "Gérer les plugins", "quick": "ACCÈS RAPIDE", "motion": "Effets 3D au survol", "motionDesc": "De légers mouvements des cartes et boutons au survol.", "langDesc": "Choisissez la langue de cette page.", "settings": "PRÉFÉRENCES", "enabled": "Activé", "disabled": "Désactivé", "pluginsFound": "Plugins détectés", "pluginsEnabled": "Plugins actifs", "active": "Interface active", "details": "Cette page est indépendante. Aucun autre plugin n’a été modifié.", "modulesTitle": "VOS MODULES", "modulesDesc": "Un accès rapide à vos plugins.", "pluginsAction": "Parcourir les plugins", "themeTitle": "APPARENCE", "themeDesc": "Personnalisez cette page sans changer vos autres thèmes.", "reduceMotion": "Les animations sont désactivées dans les paramètres système.", "configSaved": "Enregistré automatiquement par Vencord.", "ready": "Prêt"},
    es: {"control": "CENTRO DE CONTROL", "language": "Idioma", "home": "Inicio", "modules": "Módulos", "appearance": "Apariencia", "intro": "INTERFAZ PLATEADA", "tagline": "Todo DraxxCord, ordenado y fácil de usar.", "version": "v2.8", "manage": "Gestionar plugins", "quick": "ACCESO RÁPIDO", "motion": "Efectos 3D", "motionDesc": "Movimiento suave al pasar el cursor sobre tarjetas y botones.", "langDesc": "Elige el idioma de esta página.", "settings": "PREFERENCIAS", "enabled": "Activado", "disabled": "Desactivado", "pluginsFound": "Plugins detectados", "pluginsEnabled": "Plugins activos", "active": "Interfaz activa", "details": "Esta página es independiente. No se modificaron otros plugins.", "modulesTitle": "TUS MÓDULOS", "modulesDesc": "Accede rápidamente a tus plugins.", "pluginsAction": "Ver plugins", "themeTitle": "APARIENCIA", "themeDesc": "Personaliza esta página sin cambiar los demás temas.", "reduceMotion": "Las animaciones están desactivadas por el sistema.", "configSaved": "Los cambios se guardan automáticamente.", "ready": "Listo"},
    de: {"control": "KONTROLLZENTRUM", "language": "Sprache", "home": "Start", "modules": "Module", "appearance": "Design", "intro": "SILBER-OBERFLÄCHE", "tagline": "Alles für DraxxCord, übersichtlich an einem Ort.", "version": "v2.8", "manage": "Plugins verwalten", "quick": "SCHNELLZUGRIFF", "motion": "3D-Hover-Effekte", "motionDesc": "Sanfte Bewegungen beim Überfahren von Karten und Buttons.", "langDesc": "Wähle die Sprache für diese Seite.", "settings": "EINSTELLUNGEN", "enabled": "Ein", "disabled": "Aus", "pluginsFound": "Plugins gefunden", "pluginsEnabled": "Aktive Plugins", "active": "Oberfläche aktiv", "details": "Diese Seite ist eigenständig. Andere Plugins bleiben unverändert.", "modulesTitle": "DEINE MODULE", "modulesDesc": "Schneller Zugriff auf deine Plugins.", "pluginsAction": "Plugins durchsuchen", "themeTitle": "AUSSEHEN", "themeDesc": "Passe diese Seite an, ohne andere Themes zu ändern.", "reduceMotion": "Animationen sind in den Systemeinstellungen deaktiviert.", "configSaved": "Änderungen werden automatisch gespeichert.", "ready": "Bereit"},
};

const pref = definePluginSettings({
    language: {
        type: OptionType.SELECT,
        description: "DraxxCord Control Center language",
        options: [
            { label: "English", value: "en", default: true },
            { label: "العربية", value: "ar" },
            { label: "Français", value: "fr" },
            { label: "Español", value: "es" },
            { label: "Deutsch", value: "de" }
        ]
    },
    motion3d: {
        type: OptionType.BOOLEAN,
        description: "Enable subtle 3D hover effects in the Control Center",
        default: true
    },
    theme: {
        type: OptionType.SELECT,
        description: "DraxxCord Control Center color preset (does not modify your other Discord themes)",
        options: [
            {label: "Silver", value: "silver", default: true},
            {label: "Pure Black", value: "black"},
            {label: "Crimson", value: "crimson"}
        ]
    },
    compact: {
        type: OptionType.BOOLEAN,
        description: "Reduce spacing in DraxxCord Control Center",
        default: false
    },
    topbarButton: {
        type: OptionType.BOOLEAN,
        description: "Show silver D button near Discord window controls (requires reopening Discord)",
        default: true
    }
});

function words(key: keyof typeof translations.en, lang: Language) {
    return translations[lang]?.[key] ?? translations.en[key];
}

function DraxIcon({ width = 20, height = 20 }: IconProps) {
    return <svg width={width} height={height} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <image href={LOGO} width="48" height="48" />
    </svg>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string; }) {
    return <label className="vc-draxx-toggle">
        <span className="vc-draxx-toggle-track"><input aria-label={label} type="checkbox" checked={checked} onChange={e => onChange(e.currentTarget.checked)} /><span /></span>
    </label>;
}


const moreText = {
    en: { quick: "Quick Actions", diagnostics: "Diagnostics", search: "Search plugins…", all: "All", on: "Enabled", off: "Disabled", restart: "Restart required for this change to take effect.", bad: "Couldn't change this plugin. Check Vencord logs.", filter: "Filter", manage: "Plugin Manager", theme: "Color preset", compact: "Compact layout", topbar: "Top bar D button", reload: "Reload interface", refresh: "Refresh status", notice: "Controls affect real Vencord plugin settings. Some plugins need a restart.", safe: "Other plugins and their files are not modified.", noMatch: "No plugins matched your search.", desc: "All your modules in one place.", hint: "Click D in the title area whenever you need the Control Center.", needed: "Restart needed", ready: "Ready", auto: "No startup intro", disabled: "No automatic opening animation is installed." },
    ar: { quick: "إجراءات سريعة", diagnostics: "حالة النظام", search: "ابحث عن إضافة…", all: "الكل", on: "المفعّلة", off: "الموقوفة", restart: "خاصك تعاود تشغّل Discord باش يطبق التغيير.", bad: "ما قدرناش نبدلو هاد الإضافة. شوف سجل الأخطاء.", filter: "تصفية", manage: "إدارة الإضافات", theme: "لون الواجهة", compact: "واجهة مضغوطة", topbar: "زر D فالشريط العلوي", reload: "إعادة تحميل الواجهة", refresh: "تحديث الحالة", notice: "هاد الإعدادات كتتحكم فالإضافات الحقيقية. بعض التغييرات كتحتاج إعادة تشغيل Discord.", safe: "ملفات الإضافات الأخرى ما كيتبدلوش.", noMatch: "ما لقينا حتى إضافة بهاد الاسم.", desc: "إضافاتك كلها فبلاصة وحدة.", hint: "ضغط على D اللي فالفوق باش تحل لوحة التحكم وقت ما بغيتي.", needed: "خاص إعادة تشغيل", ready: "جاهز", auto: "بلا مقدمة تلقائية", disabled: "ما كاين حتى أنيميشن كتخدم بوحدها ملي كيتحل Discord." },
    fr: { quick: "Actions rapides", diagnostics: "Diagnostic", search: "Rechercher un plugin…", all: "Tous", on: "Activés", off: "Désactivés", restart: "Redémarrez Discord pour appliquer le changement.", bad: "Impossible de modifier ce plugin. Consultez les journaux.", filter: "Filtre", manage: "Gestion des plugins", theme: "Thème de couleur", compact: "Affichage compact", topbar: "Bouton D en haut", reload: "Recharger l’interface", refresh: "Actualiser le statut", notice: "Ces commandes modifient les paramètres Vencord réels. Un redémarrage peut être nécessaire.", safe: "Les fichiers des autres plugins ne sont pas modifiés.", noMatch: "Aucun résultat.", desc: "Tous vos modules au même endroit.", hint: "Cliquez sur D dans la barre du haut pour ouvrir ce centre.", needed: "Redémarrage requis", ready: "Prêt", auto: "Aucune intro au démarrage", disabled: "Aucune animation ne s’ouvre automatiquement." },
    es: { quick: "Acciones rápidas", diagnostics: "Diagnóstico", search: "Buscar plugins…", all: "Todos", on: "Activados", off: "Desactivados", restart: "Reinicia Discord para aplicar el cambio.", bad: "No se pudo cambiar el plugin. Revisa los registros.", filter: "Filtro", manage: "Administrar plugins", theme: "Tema de color", compact: "Vista compacta", topbar: "Botón D superior", reload: "Recargar interfaz", refresh: "Actualizar estado", notice: "Estos controles cambian plugins reales de Vencord. Algunos cambios requieren reinicio.", safe: "Los archivos de otros plugins no se modifican.", noMatch: "No se encontraron plugins.", desc: "Todos tus módulos en un solo lugar.", hint: "Pulsa D en la barra superior para abrir este panel.", needed: "Reinicio necesario", ready: "Listo", auto: "Sin intro de inicio", disabled: "No se activa ninguna animación al abrir Discord." },
    de: { quick: "Schnellzugriff", diagnostics: "Diagnose", search: "Plugins suchen…", all: "Alle", on: "Aktiv", off: "Inaktiv", restart: "Starte Discord neu, um die Änderung anzuwenden.", bad: "Plugin konnte nicht geändert werden. Prüfe die Protokolle.", filter: "Filter", manage: "Plugin-Manager", theme: "Farbschema", compact: "Kompakte Ansicht", topbar: "D-Knopf in der Titelleiste", reload: "Oberfläche neu laden", refresh: "Status aktualisieren", notice: "Hier werden echte Vencord-Plugins gesteuert. Manche Änderungen erfordern einen Neustart.", safe: "Dateien anderer Plugins bleiben unangetastet.", noMatch: "Keine Plugins gefunden.", desc: "Alle Module an einem Ort.", hint: "Klicke auf D in der oberen Leiste, um das Kontrollzentrum zu öffnen.", needed: "Neustart nötig", ready: "Bereit", auto: "Kein Start-Intro", disabled: "Beim Discord-Start erscheint keine Intro-Animation." }
} as const;
type MoreKey = keyof typeof moreText.en;
function more(key: MoreKey, lang: Language): string { return moreText[lang]?.[key] ?? moreText.en[key]; }

let restartFlag = false;
let topbarElement: HTMLButtonElement | null = null;
let topbarObserver: MutationObserver | null = null;

function toggleActualPlugin(p: any): { ok: boolean; restart: boolean } {
    if (p.required || p.isDependency || p.name === "DraxxCordControlCenter") return {ok: false, restart: false};
    const targetSettings = Settings.plugins[p.name];
    if (!targetSettings) return {ok: false, restart: false};
    const enabled = isPluginEnabled(p.name);
    if (!enabled) {
        try {
            const deps = startDependenciesRecursive(p);
            if (deps.failures?.length) return {ok: false, restart: false};
            if (deps.restartNeeded) {
                targetSettings.enabled = true;
                return {ok: true, restart: true};
            }
        } catch (e) { console.warn("DraxxCord: failed to start dependencies", e); return {ok: false, restart: false}; }
    }
    if (pluginRequiresRestart(p)) {
        targetSettings.enabled = !enabled;
        return {ok: true, restart: true};
    }
    if (enabled && !p.started) {
        targetSettings.enabled = false;
        return {ok: true, restart: false};
    }
    try {
        const result = enabled ? stopPlugin(p) : startPlugin(p);
        if (!result) return {ok: false, restart: false};
        targetSettings.enabled = !enabled;
        return {ok: true, restart: false};
    } catch (e) { console.warn("DraxxCord: plugin change failed", e); return {ok: false, restart: false}; }
}

function ControlCenter({ modal = false }: { modal?: boolean }) {
    const { language, motion3d, theme, compact, topbarButton } = pref.use(["language", "motion3d", "theme", "compact", "topbarButton"]);
    const lang = ((language in translations) ? language : "en") as Language;
    const tr = (key: keyof typeof translations.en) => words(key, lang);
    const mt = (key: MoreKey) => more(key, lang);
    const [page, setPage] = React.useState<Page>("home");
    const [search, setSearch] = React.useState("");
    const [filter, setFilter] = React.useState("all");
    const [version, force] = React.useReducer((n: number) => n + 1, 0);
    const [warning, setWarning] = React.useState("");
    const allPlugins = Object.values(plugins).filter((p: any) => !p.hidden);
    const count = allPlugins.length;
    const enabledCount = allPlugins.filter((p: any) => isPluginEnabled(p.name)).length;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const themeChoice = ["silver", "black", "crimson"].includes(String(theme)) ? String(theme) : "silver";
    const pluginList = allPlugins.filter((p: any) => {
        const matches = `${p.name} ${p.description ?? ""}`.toLowerCase().includes(search.toLowerCase().trim());
        return matches && (filter === "all" || (filter === "on" ? isPluginEnabled(p.name) : !isPluginEnabled(p.name)));
    }).sort((a: any, b: any) => a.name.localeCompare(b.name)).slice(0, 100);
    const rootClass = `vc-draxx-root vc-draxx-v29 vc-draxx-theme-${themeChoice}${motion3d && !reduced ? " vc-draxx-motion" : ""}${compact ? " vc-draxx-compact" : ""}${modal ? " vc-draxx-in-modal" : ""}`;
    const doToggle = (p: any) => {
        const result = toggleActualPlugin(p);
        if (!result.ok) setWarning(mt("bad"));
        else { setWarning(result.restart ? mt("restart") : ""); if (result.restart) restartFlag = true; }
        force();
    };
    return <main className={rootClass} dir={lang === "ar" ? "rtl" : "ltr"} data-draxx-refresh={version}>
        <header className="vc-draxx-hero">
            <div className="vc-draxx-hero-mark"><img src={LOGO} alt="DraxxCord D" /></div>
            <div className="vc-draxx-hero-text">
                <div className="vc-draxx-eyebrow">DRAXXCORD <span>v2.8</span></div>
                <h1>{tr("control")}</h1>
                <p>{mt("desc")}</p>
            </div>
            <div className="vc-draxx-version-chip">v2.8</div>
        </header>
        <nav className="vc-draxx-nav" aria-label="DraxxCord navigation">
            {(["home", "modules", "appearance", "quick", "diagnostics"] as Page[]).map(key => (
                <button key={key} type="button" className={page === key ? "is-active" : ""} onClick={() => {setPage(key); setWarning("");}}>{key === "quick" || key === "diagnostics" ? mt(key) : tr(key)}</button>
            ))}
        </nav>
        {!!warning && <div role="status" className="vc-draxx-alert">{warning}</div>}
        {page === "home" && <div className="vc-draxx-section">
            <div className="vc-draxx-section-heading"><h2>{tr("quick")}</h2><span className="vc-draxx-pill">{mt("ready")}</span></div>
            <p className="vc-draxx-secondary">{mt("hint")}</p>
            <div className="vc-draxx-grid">
                <button className="vc-draxx-card" type="button" onClick={() => setPage("modules")}><strong>{mt("manage")}</strong><p>{tr("modulesDesc")}</p><small>{enabledCount} / {count} {tr("pluginsEnabled")}</small></button>
                <button className="vc-draxx-card" type="button" onClick={() => setPage("appearance")}><strong>{tr("appearance")}</strong><p>{tr("themeDesc")}</p><small>{themeChoice.toUpperCase()}</small></button>
                <button className="vc-draxx-card" type="button" onClick={() => setPage("quick")}><strong>{mt("quick")}</strong><p>{mt("reload")}, {mt("refresh")}</p><small>CLIENT</small></button>
                <button className="vc-draxx-card" type="button" onClick={() => setPage("diagnostics")}><strong>{mt("diagnostics")}</strong><p>{mt("disabled")}</p><small>{mt("ready")}</small></button>
            </div>
            <div className="vc-draxx-stats"><div><strong>{count}</strong><span>{tr("pluginsFound")}</span></div><div><strong>{enabledCount}</strong><span>{tr("pluginsEnabled")}</span></div></div>
        </div>}
        {page === "modules" && <section className="vc-draxx-section">
            <div className="vc-draxx-section-heading"><h2>{mt("manage")}</h2><span className="vc-draxx-pill">{count}</span></div>
            <div className="vc-draxx-filters">
                <input aria-label={mt("search")} value={search} placeholder={mt("search")} onChange={e => setSearch(e.currentTarget.value)} />
                <select aria-label={mt("filter")} value={filter} onChange={e => setFilter(e.currentTarget.value)}><option value="all">{mt("all")}</option><option value="on">{mt("on")}</option><option value="off">{mt("off")}</option></select>
            </div>
            <p className="vc-draxx-secondary">{mt("notice")}</p>
            <div className="vc-draxx-plugins-list">
                {pluginList.length === 0 && <p className="vc-draxx-secondary">{mt("noMatch")}</p>}
                {pluginList.map((p: any) => {
                    const current = isPluginEnabled(p.name);
                    const locked = p.required || p.isDependency || p.name === "DraxxCordControlCenter";
                    return <div className="vc-draxx-plugin-row" key={p.name}>
                        <div><strong>{p.name}</strong><p>{p.description}</p></div>
                        <label className="vc-draxx-plugin-switch">
                            <input type="checkbox" checked={current} disabled={locked} aria-label={`${p.name}: ${current ? mt("on") : mt("off")}`} onChange={() => doToggle(p)}/>
                            <span className="vc-draxx-plugin-switch-ui" aria-hidden="true"/>
                        </label>
                    </div>;
                })}
            </div>
            <p className="vc-draxx-secondary">{mt("safe")}</p>
        </section>}
        {page === "appearance" && <section className="vc-draxx-section">
            <div className="vc-draxx-section-heading"><h2>{tr("themeTitle")}</h2></div>
            <div className="vc-draxx-pref"><div><strong>{tr("language")}</strong><p>{tr("langDesc")}</p></div>
                <select aria-label={tr("language")} value={lang} onChange={e => pref.store.language = e.currentTarget.value as Language}>
                    <option value="en">English</option><option value="ar">العربية</option><option value="fr">Français</option><option value="es">Español</option><option value="de">Deutsch</option>
                </select></div>
            <div className="vc-draxx-pref"><div><strong>{mt("theme")}</strong><p>{tr("themeDesc")}</p></div>
                <select aria-label={mt("theme")} value={themeChoice} onChange={e => pref.store.theme = e.currentTarget.value as any}><option value="silver">Silver</option><option value="black">Pure Black</option><option value="crimson">Crimson</option></select></div>
            <div className="vc-draxx-pref"><div><strong>{tr("motion")}</strong><p>{tr("motionDesc")}</p></div><Toggle label={tr("motion")} checked={!!motion3d} onChange={v => pref.store.motion3d = v}/></div>
            <div className="vc-draxx-pref"><div><strong>{mt("compact")}</strong></div><Toggle label={mt("compact")} checked={!!compact} onChange={v => pref.store.compact = v}/></div>
            <div className="vc-draxx-pref"><div><strong>{mt("topbar")}</strong></div><Toggle label={mt("topbar")} checked={topbarButton !== false} onChange={v => {pref.store.topbarButton = v; syncTopbarVisibility();}}/></div>
            {reduced && <p className="vc-draxx-secondary">{tr("reduceMotion")}</p>}
            <p className="vc-draxx-secondary">{tr("configSaved")}</p>
        </section>}
        {page === "quick" && <section className="vc-draxx-section">
            <div className="vc-draxx-section-heading"><h2>{mt("quick")}</h2></div>
            <div className="vc-draxx-grid">
                <button type="button" className="vc-draxx-card" onClick={() => setPage("modules")}><strong>{mt("manage")}</strong><p>{mt("desc")}</p></button>
                <button type="button" className="vc-draxx-card" onClick={() => setPage("appearance")}><strong>{tr("appearance")}</strong><p>{mt("theme")}</p></button>
                <button type="button" className="vc-draxx-card" onClick={() => {force(); setWarning("");}}><strong>{mt("refresh")}</strong><p>{mt("diagnostics")}</p></button>
                <button type="button" className="vc-draxx-card" onClick={() => window.location.reload()}><strong>{mt("reload")}</strong><p>Discord UI only — not a full application restart.</p></button>
                <button type="button" className="vc-draxx-card" onClick={restartClient}><strong>Restart Client</strong><p>Relaunch Discord Desktop (not just the interface).</p></button>
            </div>
        </section>}
        {page === "diagnostics" && <section className="vc-draxx-section">
            <div className="vc-draxx-section-heading"><h2>{mt("diagnostics")}</h2><button className="vc-draxx-small-btn" type="button" onClick={() => force()}>{mt("refresh")}</button></div>
            <div className="vc-draxx-stats"><div><strong>{count}</strong><span>{tr("pluginsFound")}</span></div><div><strong>{enabledCount}</strong><span>{tr("pluginsEnabled")}</span></div></div>
            <div className="vc-draxx-pref"><div><strong>{mt("auto")}</strong><p>{mt("disabled")}</p></div><span className="vc-draxx-pill">OFF</span></div>
            <div className="vc-draxx-pref"><div><strong>{mt("topbar")}</strong></div><span className="vc-draxx-pill">{topbarButton === false ? mt("off") : mt("on")}</span></div>
            <div className="vc-draxx-pref"><div><strong>{mt("needed")}</strong></div><span className="vc-draxx-pill">{restartFlag ? mt("on") : mt("off")}</span></div>
        </section>}
        <footer className="vc-draxx-footer">{mt("safe")}</footer>
    </main>;
}

function restartClient() {
    // Desktop-only relaunch. Never silently replace it with a UI-only refresh.
    const nativeApp = (window as any).DiscordNative?.app;
    if (typeof nativeApp?.relaunch === "function") nativeApp.relaunch();
    else console.warn("DraxxCord: Restart Client needs Discord Desktop relaunch support.");
}

function openFullControlCenter() {
    openModal(props => <ModalRoot {...props} size={ModalSize.LARGE}>
        <ModalHeader separator><div className="vc-draxx-modal-caption"><img src={LOGO} alt="" /><span>DRAXXCORD <small>v2.8 · CONTROL CENTER</small></span></div><ModalCloseButton onClick={props.onClose}/></ModalHeader>
        <ModalContent><ControlCenter modal /></ModalContent>
    </ModalRoot>);
}

function syncTopbarVisibility() {
    if (topbarElement) topbarElement.style.display = pref.store.topbarButton === false ? "none" : "flex";
}

function mountTopbarButton() {
    if (!document.body || topbarElement?.isConnected) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vc-draxx-topbar-launcher";
    button.title = "Open DraxxCord Control Center";
    button.setAttribute("aria-label", "Open DraxxCord Control Center");
    const icon = document.createElement("img");
    icon.src = LOGO;
    icon.alt = "D";
    button.append(icon);
    button.addEventListener("click", openFullControlCenter);
    document.body.append(button);
    topbarElement = button;
    syncTopbarVisibility();
}

const ENTRY_KEY = "draxxcord_control_center";
const entry = {
    key: ENTRY_KEY,
    title: "DraxxCord",
    panelTitle: "DraxxCord Control Center",
    Component: ControlCenter,
    Icon: DraxIcon
};

export default definePlugin({
    name: "DraxxCordControlCenter",
    description: "DraxxCord v2.8 topbar D launcher, full plugin manager, quick actions, appearance and diagnostics. No automatic intro.",
    authors: [{ name: "Draxx", id: 1170048531281743922n }],
    enabledByDefault: true,
    settings: pref,
    start() {
        const core = SettingsPlugin as any;
        if (Array.isArray(core.customEntries)) {
            if (!core.customEntries.some((x: any) => x.key === ENTRY_KEY)) core.customEntries.push(entry);
        } else if (Array.isArray(core.customSections)) {
            const register = (_sectionTypes: any) => ({ section: "DraxxCord", element: ControlCenter, label: "DraxxCord" });
            (this as any)._legacyEntry = register;
            core.customSections.push(register);
        } else {
            console.warn("DraxxCord Control Center: custom settings sidebar entry is unavailable in this build.");
        }
        mountTopbarButton();
        // If another overlay replaces body children, restore only our small launcher.
        topbarObserver = new MutationObserver(() => {
            if (!topbarElement?.isConnected) mountTopbarButton();
        });
        topbarObserver.observe(document.body, { childList: true });
    },
    stop() {
        topbarObserver?.disconnect();
        topbarObserver = null;
        topbarElement?.removeEventListener("click", openFullControlCenter);
        topbarElement?.remove();
        topbarElement = null;
        const core = SettingsPlugin as any;
        if (Array.isArray(core.customEntries)) core.customEntries = core.customEntries.filter((x: any) => x.key !== ENTRY_KEY);
        if (Array.isArray(core.customSections) && (this as any)._legacyEntry) core.customSections = core.customSections.filter((x: any) => x !== (this as any)._legacyEntry);
    }
});
