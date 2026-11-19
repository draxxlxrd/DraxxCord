import { showToast as nativeShowToast } from "@webpack/common";

type LegacyToastType = "success" | "critical" | "message";

function notify(message: string, type: LegacyToastType = "message"): void {
    nativeShowToast({
        text: String(message),
        ...(type === "message" ? {} : { variant: type })
    });
}

export function showToast(message: string, type: LegacyToastType = "message"): void {
    notify(message, type);
}

export const Toasts = {
    Type: {
        SUCCESS: "success" as const,
        FAILURE: "critical" as const,
        WARNING: "critical" as const,
        MESSAGE: "message" as const
    },
    genId: () => Math.random().toString(36).slice(2),
    show: ({ message, type }: { message: string; type?: LegacyToastType; id?: string }) => notify(message, type)
};
