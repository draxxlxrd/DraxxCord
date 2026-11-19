/* Vencord legacy toast compatibility adapter. */
import { showToast as nativeShowToast } from "@webpack/common";

type Kind = "success" | "critical" | "message";
function notify(message: string, type: Kind = "message"): void {
    nativeShowToast({ text: String(message), ...(type === "message" ? {} : { variant: type }) });
}
export const showToast = (message: string, type: Kind = "message") => notify(message, type);
export const Toasts = {
    Type: {
        SUCCESS: "success" as const,
        FAILURE: "critical" as const,
        WARNING: "critical" as const,
        MESSAGE: "message" as const
    },
    genId: () => Math.random().toString(36).slice(2),
    show({ message, type }: { message: string; type?: Kind; id?: string }) { notify(message, type); }
};
