/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Lee & B4lCORD Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import definePlugin from "@utils/types";

export default definePlugin({
    name: "DraxxCordNeverPausePreviews",
    description: "Prevents in-call/PiP previews (screenshare, streams, etc) from pausing even if the client loses focus",
    tags: ["Media"],
    authors: [{ name: "vappstar", id: 0n }],
    settingsAboutComponent: () => (
        <div role="alert" style={{ padding: "12px", color: "var(--text-warning)" }}>
            Warning: Keeping stream previews active may increase CPU and GPU usage.
        </div>
    ),
    patches: [
        {
            find: "streamerPaused()",
            replacement: {
                match: /streamerPaused\(\)\{/,
                replace: "$&return false;"
            }
        },
        {
            find: "StreamTile",
            replacement: {
                match: /\i\.\i\.isFocused\(\)/,
                replace: "true"
            }
        }
    ],
});
