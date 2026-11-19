/* DraxxCord Gothic: pentagram launcher icon, original functionality unchanged. */
export function SelfBotIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="DraxxCord Gothic">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.35" />
            <path d="M12 3.9 16.8 19 4.1 9.7h15.8L7.2 19Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="1.15" fill="currentColor" />
        </svg>
    );
}
