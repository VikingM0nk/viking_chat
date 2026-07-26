# viking_chat

Western-styled RedM chat for Darkwood County. Replaces the default GTA Online chat box with floating text that fades out and a slim centered composer that only appears while typing.

## Behaviour

- **No permanent chat window** — messages float top-left with text shadow only
- **Auto-fade** after a few seconds (longer while the composer is open)
- **Composer** — bottom-center parchment bar (T / text chat key)
- **Esc** cancels, **Enter** sends, **Tab** completes suggestions

## Install

1. Sync to the server as a resource folder named **`chat`** (required for `exports.chat`).
2. In `server.cfg`:
   ```cfg
   set resources_useSystemChat false
   ensure chat
   ```
3. Restart the server (or `ensure chat` after stopping the old one).

## Sync

```powershell
& "C:\Users\Darlene\OneDrive\Desktop\RedM Scripts\sync-viking-chat.ps1"
```
