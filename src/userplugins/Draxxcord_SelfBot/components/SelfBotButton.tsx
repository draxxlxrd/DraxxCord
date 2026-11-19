/* DraxxCord — Umbral launcher in the account panel, not the message composer. */
import { ReactDOM, useEffect, useRef, useState } from "@webpack/common";
import { SelfBotIcon } from "./SelfBotIcon";
import { SelfBotMenu } from "./SelfBotMenu";

export function SelfBotButton() {
    const buttonRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) return;
        const onOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (buttonRef.current?.contains(target)) return;
            if (target.closest(".selfbot-menu-container")) return;
            setOpen(false);
        };
        document.addEventListener("mousedown", onOutside);
        return () => document.removeEventListener("mousedown", onOutside);
    }, [open]);

    return <div ref={buttonRef} className="vc-draxxcord-umbral-launcher">
        <button type="button" className="vc-draxxcord-account-button" title="Open DraxxCord Umbral" aria-label="Open DraxxCord Umbral" onClick={() => setOpen(value => !value)}>
            <SelfBotIcon />
        </button>
        {open && ReactDOM.createPortal(<SelfBotMenu closePopout={() => setOpen(false)} />, document.body)}
    </div>;
}
