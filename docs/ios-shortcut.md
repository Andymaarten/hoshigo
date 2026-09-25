# The "Add to hoshigo" iPhone Shortcut

iOS web apps can't appear in the share sheet, so a Shortcut does it for us. The owner's shared
copy lives at https://www.icloud.com/shortcuts/7c76b6fb4a08439ea161423711350bba and is the
default for the "Get the iPhone shortcut" button on /app. To point the button somewhere else,
set `NEXT_PUBLIC_IOS_SHORTCUT_URL` in Vercel and redeploy.

## Building it (iOS 18)

1. Open the **Shortcuts** app and tap **+** (top right) to make a new shortcut.
2. Tap the name at the top, choose **Rename**, and call it **Add to hoshigo**. While there,
   **Choose Icon** lets you pick a colour and glyph (red, a star).
3. Tap the **i** (Details) button at the bottom and turn on **Show in Share Sheet**. Tap
   **Done**.
4. A block now says *Receive **Images and 18 more** input from **Share Sheet***. Tap
   **Images and 18 more**, tap **Clear**, then select only **URLs** and **Text**. Tap outside
   the list.
5. In the same block, tap **Continue** after *If there's no input* and choose **Stop and
   Respond** (so running it without anything shared does nothing).
6. Tap **Search Actions** at the bottom, type **Open URLs**, and tap it to add it.
7. Tap the **URL** placeholder in *Open URL*, type `https://hoshigo.cc/add?via=shortcut&url=`,
   then, with the cursor right after the last `=`, tap **Shortcut Input** in the variable bar
   above the keyboard. The field should read `https://hoshigo.cc/add?via=shortcut&url=`
   followed by a blue *Shortcut Input* token, with no space between them. (`via=shortcut`
   only tells our stats the add came from the Shortcut; it must come before `url=`.)
8. Tap **Done**.

No encoding step is needed: /add reads everything after the first `url=` as the link
(see docs/add-link.md).

## Testing it

In Safari, open any film on IMDb, tap the share icon, scroll the row of actions and tap
**Add to hoshigo**. hoshigo opens with the add dialog and the link filled in. The first time,
iOS asks whether the shortcut may open hoshigo.cc: choose **Always Allow**.

## Sharing it

1. In the Shortcuts app, long press **Add to hoshigo** and choose **Share**.
2. Tap **Copy iCloud Link**. (If it asks, turn on **Allow Sharing** under Settings, Apps,
   Shortcuts, Advanced, or accept the prompt.)
3. That link is what the /app page uses. Anyone opening it on an iPhone gets **Add Shortcut**.

If the shortcut changes, share it again: iCloud links point at a copy, not a live version.

## Updating the existing shortcut

Open **Add to hoshigo** in the Shortcuts app, tap the address in *Open URL*, and change
`https://hoshigo.cc/add?url=` to `https://hoshigo.cc/add?via=shortcut&url=` (keep the
Shortcut Input token right after it). Then share it again as above and send the new iCloud
link to Lucas, or set it as `NEXT_PUBLIC_IOS_SHORTCUT_URL`. Old copies keep working; they
just count as "direct" in the stats.
