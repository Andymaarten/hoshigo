# Adding from anywhere: hoshigo.cc/add?url=

Open `https://www.hoshigo.cc/add?url=<link>` and hoshigo opens your own page with the add
dialog on "Paste a link", the link filled in, and reading it already started.

- **Everything after the first `url=` is the link**, exactly as written, including later
  `?`, `&` and `#`. So
  `https://www.hoshigo.cc/add?url=https://translate.google.com/?sl=ja&tl=nl&text=星五&op=translate`
  adds `https://translate.google.com/?sl=ja&tl=nl&text=星五&op=translate`. You don't need to
  encode the link. If it *is* encoded as a whole (`url=https%3A%2F%2F…`), it's decoded once.
  A link that merely contains `%20` or `%26` somewhere is left alone.
- **Not logged in:** you log in (password, magic link or a new account with onboarding) and
  then land in the same add dialog with the same link. The link waits in a cookie for 30
  minutes.
- **Missing or not a link:** the dialog opens on the paste screen with whatever text was
  given; if it isn't a link, it offers to search for it instead.
- The link only ever goes into the input box. hoshigo never opens or redirects to it from
  this address.

## Bookmarklet (desktop browsers)

Make a new bookmark and paste this as its address (URL). Clicking it on any page adds that
page to hoshigo:

```
javascript:location.href='https://www.hoshigo.cc/add?url='+location.href
```

To make it: show the bookmarks bar (Ctrl/Cmd+Shift+B), right click it, *Add page…* (Chrome)
or *New bookmark…* (Firefox), name it "hoshigo", and paste the line above as the URL. In
Safari, bookmark any page first, then edit that bookmark's address.

## Android: "Share to hoshigo"

On Android (Chrome, Edge, Samsung Internet), open hoshigo.cc, choose *Install app* / *Add to
Home screen*. After that, hoshigo appears in the share sheet of other apps (Spotify, YouTube,
the browser…). Sharing sends the link to `/add`. This uses the web manifest's
`share_target` (`src/app/manifest.ts`). Apps that put the link inside the share text instead
of the URL field work too; the dialog picks the link out of the text.

## iPhone and iPad

iOS doesn't support `share_target` for web apps, so hoshigo can't appear in the share sheet
directly. Two options that do work:

1. **Shortcut (recommended).** In the Shortcuts app: *New Shortcut* → turn on *Show in Share
   Sheet* (in the shortcut's details) and set it to receive *URLs*. Add the action *Open
   URLs* with the text `https://www.hoshigo.cc/add?url=` followed by the *Shortcut Input*
   variable. Name it "Add to hoshigo". It then shows in the share sheet of Safari, Spotify,
   YouTube and so on.
2. **Bookmarklet in Safari.** Add the bookmarklet above as a Safari bookmark (bookmark any
   page, then edit its address). Open the bookmarks while on a page and tap it.
