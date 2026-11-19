# ShowHiddenChannelsLite

A Vencord userplugin that keeps ShowHiddenChannels alive after Discord's November 2026 change.

## What changed

Discord now strips hidden channels on the server. Every channel you can't view arrives with the name `___hidden___`, an empty topic and a fake permission overwrite (`@everyone` denied View Channel). The real name, topic and allowed roles never reach your client, so no plugin can show them anymore. That's why the original ShowHiddenChannels was marked as dead.

## What still works

- Hidden channels show up in the channel list with a lock, at their real position and in their real category, including hidden categories and servers that use onboarding (Browse Channels)
- Their type is real (text, voice, forum, stage, announcement)
- You can see who is sitting in a hidden voice channel
- Locked channels (visible but no Connect) still show their real allowed users and roles

Hidden channels are labelled `hidden` in the list instead of `___hidden___`. You can change that text in the plugin settings. Hidden categories keep Discord's own "No Access" label.

## Install

Userplugins need Vencord built from source. If you haven't done that yet, follow the [official guide](https://docs.vencord.dev/installing/).

```sh
cd Vencord/src/userplugins
git clone https://github.com/CyberKird/showHiddenChannelsLite
cd ../..
pnpm build
pnpm inject
```

Restart Discord, then in Vencord settings disable **ShowHiddenChannels** and enable **ShowHiddenChannelsLite**. Don't run both at once, they patch the same code.

## Credits

Based on ShowHiddenChannels by the Vencord team (BigDuck, AverageReactEnjoyer, D3SOX, Ven, Nuckyz, Nickyux, Rini). Licensed under GPL-3.0, like Vencord.
