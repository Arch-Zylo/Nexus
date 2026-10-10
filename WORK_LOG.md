# Nexus — Work Log

## Update 21 — Full pages, Mode in the menu, new Chill dashboard (still v1.5.0 beta)
- [x] **Password, Settings and Profile are now full pages** (`view-passwords`, `view-settings`, `view-profile`) opened from the menu; the dropdown only holds the menu and the About page. They work with the Android Back button like any other screen (`navRestore` handles views without a rail button). The Password Manager row in Settings opens the Passwords page. The password manager's own Back button was removed
- [x] **Profile page** (`features/regular/ProfileView.js`): avatar, name and school edited inline with Save (replaces the prompt-based rows), plus counts of classes, open tasks, notes and people. The menu's profile card shows the saved name/school
- [x] **Mode** added to the menu right after Theme: one tap switches Regular ⇄ Chill, closes the menu and lands on the matching dashboard (value shown on the row)
- [x] The menu highlights the page you are on (Dashboard / Password / Settings / Profile)
- [x] **Chill dashboard rebuilt** (`ChillHome.js`): greeting, then **Recently Added → Music → Watch → Read → Favorites** as horizontal shelves with "See all" links; the old status tiles, quick tiles and the Now Playing / Continue panels were replaced (the playing song is the first card of the Music shelf with its progress bar and play/pause; paused videos and part-read series come first in Watch / Read with progress bars). Favorites shows anything with a heart — only songs can be hearted today
- [x] Fixed while testing: a permanently-open `.sheet` is read by the sheet watcher as an open layer and breaks Back — the profile form uses its own class
- [x] Tests: full pages, menu order and actions, Mode both ways, Back through pages, profile save, shelf order — 55/55 pass
**Not verified:** on a real Android device

## Update 20 — Menu in the reference style (still v1.5.0 beta)
- [x] The ☰ dropdown is now a menu like the reference screenshot: a left-aligned panel (84% of the width on phones, 340 px on larger screens) that drops from the top bar, profile card on top, then **Dashboard · Password · Theme · Settings · Profile · About app** with icons, a gold highlight on Dashboard when you are on the home screen, and a footer with the version. The ☰ stays in view (turns into an X) and toggles it
- [x] Item actions: Dashboard → home (or Chill home) and closes the menu; Password → the password manager; Theme → cycles the theme in place (value shown on the row); Settings / Profile / About app → pages inside the dropdown with a ‹ Back to the menu. Android Back steps back through them (page → menu → closed)
- [x] Reorganised: the Profile group (name, school) moved to the Profile page; the About group (app, version, storage, terms) moved to About app; the rest stays under Settings. Version text now comes from `APP_VERSION_LABEL` everywhere
- [x] Tests: menu items, Theme, Password and Back, Settings/Profile/About pages, Android Back inside a page, Dashboard — 54/54 pass
**Not verified:** on a real Android device

## Update 19 — Custom greetings + dropdown Settings (still v1.5.0 beta)
- [x] **Settings → Greeting** (new panel, `features/regular/GreetingPanel.js`): upload, replace, play and remove a clip for Morning / Afternoon / Evening / Night plus "Any time", "Play greeting now", "Remove all my clips", and the on/off switch. Validation: audio only, ≤ 6 MB, ≤ 30 s, unreadable files rejected with a message. Clips live in the on-device media database (`greet:<slot>`, with name and length), so they are not in JSON/zip backups and are cleared by Wipe all data / restoring a backup
- [x] Playback order (`Greeter.playFile`): your clip for the current time → your "Any time" clip → default `assets/greeting.mp3` → built-in voice (wording changes by time of day). The `assets/greetings/` folder idea from Update 18 is gone — uploads replace it
- [x] **Settings now drops down** from the top bar instead of sliding in from the side: full width on phones (bottom bar stays visible), a 440 px panel under the ☰ on larger screens; 0.18 s fade/drop, none with reduced-motion. The ☰ stays in view (turns into an X) and toggles it; tapping the dimmed area or Android Back also closes it. The old drawer header and ✕ were removed
- [x] Tests: dropdown geometry/toggle/scrim/Back, greeting panel (upload per slot, fallback chain, replace, remove, rejection, remove all) — 53/53 pass
**Not verified:** on a real Android device (file picker, audio formats the phone's WebView can't decode)

## Update 18 — Greeting clip + time of day (still v1.5.0 beta)
- [x] Supplied clip cleaned up and shipped as `www/assets/greeting.mp3` (leading silence trimmed, loudness normalised from about -30 dB to -16 dB, short fades, mono 96 kbps, 3.8 s, 45 KB)
- [x] **Time of day**: `Greeter.slot()` → morning 05–11:59, afternoon 12–16:59, evening 17–20:59, night 21–04:59. Plays `assets/greetings/<slot>.mp3` if present, else `assets/greeting.mp3`, else the built-in voice, whose wording also follows the time of day. Only the all-day clip exists so far — add the four per-time files to `www/assets/greetings/` (see the README.txt there) when you have them
- Not done on purpose: no new speech was generated or cloned in the character's voice; the clip is the user's own file and only edited (trim/normalise). Bundling it in an app that is shared or published may need the rights holder's permission
- [x] Tests: clip order and wording for all four time slots (fake clock), plus the earlier greeting checks — 52/52 pass; real clip playback and per-time clip priority/fallback checked separately
**Not verified:** on a real Android device

## Update 17 — Greeting voice (still v1.5.0 beta)
- [x] **Spoken greeting once per app launch** (`core/Greeter.js`). Plays once when Nexus opens and never again while the app stays open (returning from the background is not a new launch). Waits for the Terms gate on first run and for the app lock (greets after unlocking). If the system blocks autoplay, it plays on the first tap instead. Settings → Preferences → **Greeting voice** (On by default; turning it on plays a preview)
- Voice: if `www/assets/greeting.mp3` exists it plays that; otherwise the device's built-in speech (English, higher pitch, slower rate) says "Ara ara... welcome back, <name>. I've been waiting for you." It does not imitate any real voice. Built-in speech depends on the phone's text-to-speech and can be missing inside some Android WebViews — a supplied clip is the reliable route
- [x] Tests: once per launch, not on resume, silent while locked then greets after unlock, off switch, name in the line, supplied clip preferred — 51/51 pass
**Not verified:** on a real Android device (WebView speech availability, autoplay)

## Update 16 — Settings drawer + optional app lock (still v1.5.0 beta)
- [x] **Settings is now a drawer**: ☰ slides a panel in from the left over the current screen (short 0.2 s slide, none with reduced-motion), with a Nexus header and a profile card (initial, name, school) above the same settings rows. Closes with ✕, a tap on the dimmed area, the ☰ again or Android Back; the screen underneath is never replaced. Settings is no longer a navigation view (`Shell.openSettings/hideSettings/closeSettings`; `navigate('config')` is gone)
- [x] **App lock (optional)**, Settings → Security → App lock. 4-digit PIN stored as a salted SHA-256 hash under its own key `nexus-applock-v1` — not in the main store, so it is never in backups/exports, and a restored backup can't switch the lock off. Keypad screen (`core/AppLock.js`) serves unlock, set PIN (enter twice), confirm-to-turn-off and change PIN. Auto-lock: Immediately / After 1 minute (default) / After 5 minutes, using visibility change + Capacitor `appStateChange`; "Lock now" row; locked at app start with no flash (inline reveal in index.html); app behind the lock is `inert`; Android Back does nothing but the double-tap-to-exit while locked. 5 wrong PINs → cool-down (30 s, doubling, max 15 min). **Forgot PIN** → two confirmations, then everything on the device is erased and the lock removed (`BackupService.performWipe`, split out of `wipeAllData`)
- Limits: it is a gate on the app, not encryption — data in storage is still readable by anyone who can inspect the device/app storage; no fingerprint/face unlock (needs a native plugin); no screenshot/recents-thumbnail blocking (needs Android FLAG_SECURE)
- [x] Tests: drawer open/close paths (✕, scrim, Back) and app lock flows (set, mismatch, lock now, wrong/right PIN, delay modes, reload, cool-down, change, turn off, forgot) — 49/49 pass
**Not verified:** on a real Android device (hardware Back while locked, resume from background, recents thumbnail)

## Update 15 — v1.5.0 (beta): hamburger Settings, no-deadline tasks
- [x] **Settings moved to a hamburger (☰) button in the top bar** and removed from the bottom/side rail (both Regular and Chill). Tapping it opens Settings and the icon turns into an X; tapping again returns to the screen you came from. Screen switching now lives in `Shell.navigate()` (used by the rail, the hamburger, the Back button and the Mode row)
- [x] **Tasks can have no deadline**: new "No deadline" checkbox in the task form (date picker greys out). Order: unfinished tasks by soonest date, then unfinished no-deadline tasks, then finished tasks. No-deadline tasks show a "No deadline" tag, never get reminders, and are left out of Home → Due Soon (they still count in Open Tasks). Existing tasks are unaffected
- [x] Version bumped to **v1.5.0 (beta)** (constants, Terms header, Settings row, package.json `1.5.0-beta`, README)
- [x] Fix: hidden buttons were still visible (the Delete button showed on a new task form)
- [x] Tests: e2e updated for the hamburger; new checks for the toggle and for task ordering / no-deadline (43/43 pass in headless Chromium, phone viewport)

**Not verified:** on a real Android device (hardware Back with the hamburger, notifications)

## Update 14 — Object-oriented restructure
- [x] **`www/nexus.js` (3,894 lines of global functions + variables) is now 49 small ES-module files**, one class each, under `www/js/` (`core`, `storage`, `media`, `ui`, `features/regular`, `features/chill`, `backgrounds`). `fx.js` became `ProgressCard`, `ListAnimator` and `Motion`; `nexus.css` moved to `www/css/`. See README → Architecture
- [x] `App` is the composition root; every service and feature view extends `Component` and talks to the others as `this.app.<name>` instead of through globals. Shared data is `this.state`
- [x] Methods are auto-bound (safe to pass as callbacks); pure helpers are static classes (`Util`, `Dom`, `Icons`, `Platform`…); shared data is in `core/constants.js`
- [x] Cross-component writes were replaced by methods: `OverlayManager.recordNav`, `AudioPlayer.refreshQueue / stop / seekFraction / toggleShuffle / cycleRepeat`
- [x] **Behaviour is unchanged.** The conversion was done by a script that resolves every identifier with the TypeScript compiler (so no reference could be missed), then verified three ways: type-check of all modules (no unresolved names/imports; deliberately planted bad references were caught), the same 41-check browser test passing on the old and new builds, and the saved app state after the test run being identical in both
- [x] New: `tests/e2e/` (Playwright) with `npm run test:e2e`

**Not verified / limits:** not run on a real Android device — ES modules should work in Capacitor's WebView but please test an APK. Code paths that only run natively are untested here (local notifications, saving backups through the Filesystem plugin, the hardware back button). The classes keep the original method bodies, so some methods are still long (for example `HomeView.drawHome`); splitting those is a follow-up. The one-off conversion script is not part of the project

## Update 13 — Manga reading transitions
- [x] **Paged modes (LTR / RTL):** the next page slides + fades in from the direction you read towards (reversed for RTL). The image is decoded before it appears, so there is no flash, and the neighbouring pages are pre-loaded so turns feel instant. Fast taps no longer show pages out of order
- [x] **Chapter or reading-mode change:** old pages fade down, new ones rise in
- [x] **Scroll mode:** pages fade in as they load, with a soft pulsing placeholder while loading
- [x] **Page counter** pops when it changes, and a thin gold **reading-progress line** runs along the bottom (fills from the right in RTL)
- [x] Top/bottom bars now fade as well as slide; the chapter list slides up and down; the reader zooms out when closed
- [x] Off when "reduce motion" is on. Syntax-checked only (no browser available): please test page turns in all 3 modes, switching chapter, and closing the reader quickly after opening

## Update 12 — Import progress + motion
- [x] **Progress card** (new `www/fx.js`, `window.NxProgress`) slides in at the top for every import: music/video (by file size, "2 of 5 · name"), manga (by page, plus a "Reading archive" step for .cbz/.zip), full `.nexusbackup` restore (media file n of N, then "Finishing up") and plain .json backup import. Shows a percentage, shimmering bar, turns green on success and red on failure; indeterminate sliding bar while the total isn't known
- [x] **Press feedback** on every button, row, card, tile and player control; inputs get a soft focus glow
- [x] **Dialogs** rise/settle in and out; the manga **bottom sheet** now slides up and down (close is delayed ~190 ms)
- [x] **Full-screen layers** animate in: Now Playing (slide up), video player and manga reader (zoom-fade), series page (slide in), mini-player, notes editor, Passwords/Mode panels, Terms, and the Music/Video/Manga inner tabs
- [x] **Lists:** newly added rows glide in (staggered), deleted rows collapse out. Done generically by a MutationObserver in `fx.js`, so no draw functions changed. Rapid redraws (live updates) are not animated
- [x] **Theme and Mode switches** cross-fade instead of snapping; toast gets a coloured status dot
- [x] All new motion is off when the phone's "reduce motion" setting is on (progress card still shows, without animation)

**Not verified:** no browser was available in this session, so only syntax checks were run (`node --check`). Please test on the phone: an import of several songs, a .cbz, and a backup restore; deleting a row; opening Now Playing
**Not done:** exit animations for full-screen layers (they appear with motion but close instantly); export has no progress card yet

## Update 11 — Chill dashboard
- [x] Chill home now mirrors the Regular home: a time-of-day greeting with a library summary, and **status tiles** in the same layout — *In Your Library* (total items), *Songs*, *Videos*, *Manga series*, *Stories* — plus a donut showing the library mix (songs / videos / manga / stories). Every tile jumps to its section
- [x] **Preview panels** like Today's Classes / Due Soon: *Now Playing* (cover, artist, progress bar, play/pause; tap to open the player), *Continue Reading* (manga you've started, chapter + page, progress bar; tap resumes), *Continue Watching* (videos you paused part-way, with progress; tap resumes), *Favourites* (♡ songs; tap plays), and *Recently Added* (a swipeable strip of covers for songs, videos, manga and stories)
- [x] Videos now **remember where you stopped** and resume there (short clips included); this feeds Continue Watching
- [x] Now Playing on the dashboard updates live while a song plays
- Kept the Music / Watch / Read / Import shortcut tiles

**Verified in headless Chrome:** empty and filled dashboards, every tap target, play/pause from the dashboard, resume of video and manga
**Not done:** a "recently played songs" list and listening stats (we don't record play history yet)

## Update 10 — Back button (native), landscape video, icons, Version row
- [x] **Back button on Android, second attempt.** The history-based Back from Update 9 did not work in the phone's WebView, so Back is now handled by Capacitor's own App plugin: each press closes the newest layer (sheet, player, reader, editor, panel, Terms), otherwise returns to the previous screen, otherwise (on Regular Home) shows "Press back again to exit" and a second press exits. It no longer depends on WebView history. In a normal browser the earlier history-based Back is still used. **New dependency: `@capacitor/app`** (installed automatically by `npm install` in the workflow)
- [x] **Landscape videos now rotate the player automatically** when a video is wider than tall; portrait videos stay upright. The ⛶ button toggles it for any video. With the new `@capacitor/screen-orientation` plugin Android really rotates the screen; if that isn't available the player turns itself 90° so it is still landscape. Root cause of the old behaviour: the fullscreen request waited on the WebView, which never answers, so the rotation never ran. **New dependency: `@capacitor/screen-orientation`**
- [x] Video and mini-player controls were emoji characters (⏸ ⏮ ⏭ ⟲ ⟳ ⛶), which Android draws as orange emoji and garbles. They are now proper SVG icons, including the 10-second skip buttons
- [x] **Settings → About showed two "Version" rows** (the old 1.2.0 and the new one). Now one row: v1.4.6 (beta)

**Verified in headless Chrome:** Back through screens, sheets, panels, players, mode switches and the two-press exit using a simulated Capacitor App plugin; landscape vs portrait video; controls rendering; one Version row
**Not verified on a phone (cannot build an APK here):** the real Back button and the real screen rotation. If either misbehaves in the next build, tell me exactly what happens

## Update 9b — fully offline
- [x] Removed the Google Fonts links (DM Sans + IBM Plex Mono). They were the **only** network request in the app: each launch while online contacted fonts.googleapis.com / fonts.gstatic.com, which exposes the user's IP address to Google. Verified by blocking all networking in a test browser and logging every request: before = 1 attempt, after = 0
- [x] Fonts now come from `www/fonts/` (drop-in, see fonts/README.txt) or fall back to the phone's system fonts
- [x] Terms updated: "works fully offline"
- [ ] Optional: the Android manifest still declares the INTERNET permission by default (unused). Removing it would make "offline" enforceable by the OS, but must be tested on a real build first

## Update 9 — v1.4.6 (beta), Back button, new Terms
- [x] **Android Back no longer closes the app mid-use.** Every screen change now adds a history entry, so Back steps through the screens you visited (including switching between Regular and Chill). Back also closes things first: add/edit sheets and dialogs, the Now Playing screen and its menu, the video player, the manga reader, the series page and its sheets, the note editor, the Passwords panel and the Terms. Back on the first screen (Regular Home) still exits the app
- [x] Tapping another tab while the note editor is open saves and closes the editor, so Back doesn't need an extra press
- [x] Version is now **v1.4.6 (beta)**: shown in Settings (new Version row), in the Terms, in package.json (`1.4.6-beta`, which also becomes the Android versionName) and the README
- [x] **Terms rewritten for this version** (data stays on device; beta software; Chill Mode files and your responsibility for them; passwords not encrypted and included in backups; .nexusbackup and Wipe All Data; the Google Fonts request; notifications; no warranty). Everyone sees them once more because the acceptance key changed to `nexus-tos-v2`

**Verified in headless Chrome (simulated Back presses):** views, sheets, Cancel-then-Back (one press), Terms, Passwords panel, note editor, switching tabs with the editor open, Chill mode and back to Regular, Now Playing + its menu, manga series page + sheet
**Not verified on a phone:** the real hardware Back button inside the Android WebView

## Update 8 — import bug + QA pass (tested in a headless browser)
**Fixed**
- [x] **Manga "Select panels" did nothing**: two elements shared the id `mgChName` (the reader's chapter label and the chapter-name box), so the sheet read the wrong one and crashed. Renamed. The pickers are now real label buttons inside the sheet, and .cbz/.zip has its own picker so Android lists .cbz files
- [x] **Thumbnails drew at full size and tiled** (the "honey" art repeated twice): the placeholder gradient reset the background sizing. Affects every cover (music, video, manga, mini-player)
- [x] A "No readable images found" message appeared after every successful manga import (a misplaced else)
- [x] Chapters sort by their number, so "Chapter 2" comes before "ch3"

**Added**
- [x] Music art: a ring that spins around the circle, plus an orbiting dot (both pause when the song pauses)
- [x] Live audio graph under the art. It listens to the playing audio without re-routing it, so playback is unaffected

**Verified end to end (headless Chrome):** add chapter from images, from .cbz, from a folder of chapters; whole-folder import; MP3 tags + wide cover; video thumbnail + duration; manga reader; export .nexusbackup → wipe (0 entries, 0 stored files, no local backup) → restore (all 19 files back)
**Not verified on a phone:** the real Android file picker, folder picking, share sheet, and the audio graph on Android WebView

## Update 7 — music player rebuilt to match the reference screenshots
- [x] Now Playing is a 3-page swipe screen: **queue** (current song marked with an animated equalizer) · **round album art** (default page) · **lyrics**, with page dots
- [x] Blurred album-art background, title + artist at the top, share and ⋮ buttons, ♡ favourite (bottom-left) and shuffle (bottom-right)
- [x] White control panel: previous / play-pause / next and a red seek bar with elapsed and total time
- [x] Title, artist, album art and embedded lyrics are now read from each MP3's ID3 tag (on import, and once for songs already imported)
- [x] Lyrics: add / paste / edit; lines like `[01:23.45] text` become synced lyrics that highlight and scroll with the song
- [x] ⋮ menu: edit lyrics, repeat mode (all / one / off), delete song. Row ⋮ in the queue: play, delete. Share sends the audio file through Android's share sheet
- [x] Android back button now closes the player, video player, manga reader and series page instead of leaving the app
- [x] Music list shows artist instead of file size; library tracks keep their place when the list re-sorts

## Update 6
- [x] The app always opens in Regular mode on the Home page, whatever mode it was in last time. Chill is entered on purpose (Settings → Tools → Mode); restored backups also open in Regular

## Update 5 — new manga import flow
- [x] Import → Manga: a round **+** button opens a chooser — **New series** or **New chapter**
- [x] New series: type a title, Create, and you land inside the series page where **＋ Add chapter** lives (also "Import a whole folder instead")
- [x] New chapter: pick a series, name the chapter (pre-filled "Chapter N"), then select panels / .cbz / .zip, or a folder of chapters
- [x] Series page: chapter list with page counts, delete chapter, delete series; tap any series in the Import list to open it
- [x] Empty series are allowed; the library shows a message if you open one with no chapters
- [x] Removed the old `title/chapter` text field (replaced by the flow above)

## Update 4 — fixes from the outside audit (checked against the code first)
All the data-safety claims below were confirmed in the code before fixing.

**Fixed**
- [x] Backup now includes Chill media: with music/video/manga present, Export makes a `.nexusbackup` file (ZIP: manifest.json + data.json + media/). Import restores the files too. Plain JSON is still used when there is no media. Backups carry `backupVersion` / `appVersion`; old plain-JSON backups still import
- [x] Wipe All Data now also clears the media database, thumbnails, the on-device backup copy, and resets to a full default store (it was missing the Chill fields)
- [x] Imports are validated and repaired before they can replace the live data (`{"tasks":{}}` becomes `[]`; non-backup files are rejected with "Nothing was changed")
- [x] `save()` catches storage-full errors and tells the user
- [x] Android `versionCode` = GitHub run number, `versionName` = package.json version (now 1.3.9), so each APK installs as an update
- [x] Pull requests build an unsigned debug APK; signed release only on push/manual
- [x] Media import counts are real (imported / failed), storage-full is reported, and large imports (>200 MB) ask first
- [x] Missing media files show "File unavailable" and a message instead of silently doing nothing; audio/video playback errors show a message
- [x] Manga vertical resume waits for the saved page to load before scrolling; missing pages show "Page unavailable"
- [x] Thumbnail object URLs are released on delete
- [x] Settings → Storage shows app data and total device usage (includes media)
- [x] Task reminders are scheduled up to 60 days ahead (were only today/tomorrow)
- [x] Password "Copied" only shows if the copy worked
- [x] All `alert()` pop-ups replaced with toasts; media/manga imports show progress

**Not done**
- [ ] Password manager is still plain text (P0 security). Needs a design decision: a master password with encryption, where forgetting it means the passwords are lost
- [ ] Backups over 4 GB are refused (ZIP64 not implemented)
- [ ] Per-item "Remove" button on an unavailable file (the label shows; remove it from Import)
- [ ] Rename series / chapter, reorder chapters, choose a custom cover
- [ ] Browser-vs-APK reminder wording in Settings

## Update 3
- [x] APK download: workflow uploads `app-release.apk` directly (`upload-artifact@v7`, `archive: false`) — no zip
- [x] Themes now work in Chill mode: the lounge palette is only the default (Night); any other theme overrides it
- [x] Video fullscreen goes landscape (native lock when available, CSS rotation fallback otherwise); exits back to portrait
- [x] Mode is a Theme-style row in Settings (shows Regular/Chill, one tap flips it); also a toggle button above the theme button on the side rail
- [ ] Old Mode picker panel is no longer reachable (code left in place)

## Chill Mode update
**Players (modelled on the Files app)**
- [x] Music: mini-player now has a progress line; tap it to open a full-screen Now Playing screen
- [x] Now Playing: art tile, seek bar + times, prev / play-pause / next, shuffle, repeat (all / one / off)
- [x] Prev button restarts the track if it is >3s in, otherwise goes to the previous track
- [x] Video: full-screen player replaces the popup — play/pause, ±10s buttons, seek bar, speed (0.75–2×), fullscreen
- [x] Video: tap to show/hide controls, double-tap left/right to skip 10s, controls auto-hide; music pauses when a video starts

**Lyrics**
- [x] Dedicated Lyrics tab in Now Playing; add, paste, edit or clear lyrics per track
- [x] Saved with the track in local storage; music list shows "♫ lyrics" when a track has them

**Manga import**
- [x] Path field `manga_title/chapter 1` + select many panels at once; adding to an existing title adds a chapter
- [x] Panels sorted by file name in natural order (image1, image2, … image10)
- [x] "Import folder" reads `title/chapter/images` and creates all series and chapters in one go
- [x] Reader: series → chapter list → chapter with Prev / Next chapter buttons
- [x] Older single-series imports are still read as "Chapter 1"

**Files touched:** `www/index.html`, `www/nexus.js`, `www/nexus.css`, `WORK_LOG.md`

## Update 2 — thumbnails + manga rebuilt from the Manga Reader app
**Thumbnails**
- [x] Music: album art read from the MP3's embedded tag; otherwise a coloured tile from the title. Shown in the list, mini-player and Now Playing
- [x] Video: a frame from near the start, plus a duration badge. Shown on video tiles
- [x] Manga: first page of the first chapter becomes the cover
- [x] Thumbnails are generated once, cached in the device database, and cleaned up on delete

**Manga (ported from base.apk / Manga Reader)**
- [x] Import folder: a series folder with a sub-folder per chapter, or a folder of series; chapters detected automatically
- [x] Import images and .cbz/.zip (own ZIP reader, no libraries); each archive becomes a chapter
- [x] `manga_title/chapter 1` path field kept; no chapter typed = next "Chapter N"
- [x] Cover grid; tapping a series opens the reader and resumes where you stopped
- [x] Reader: vertical scroll, paged left-to-right, paged right-to-left; tap zones, chapter list, prev/next chapter, page counter
- [x] Import progress ("Importing… 12/80 pages")

**Not ported yet:** search/filter/sort, mark-as-read, fit-to-width, wake lock, Android back button, drag-and-drop
**Files touched:** `www/index.html`, `www/nexus.js`, `www/nexus.css`, `WORK_LOG.md`

## Earlier
- [x] In-page notes editor (Google Keep style, auto-save)
- [x] Mode button in Settings → Tools (no action yet)
- [x] Native launch screen with logo + "Developed by: Arch-Zylo" (`assets/launch-screen.png`)

## Open / not done
- [ ] Mode button has no function yet
- [ ] Per-chapter delete (currently delete whole series from Import)
- [ ] Folder import needs a WebView that supports folder picking; .cbz/.zip and multi-image import do not
- [ ] Not tested on a device or built into an APK
