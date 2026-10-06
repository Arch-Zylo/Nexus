# Nexus — Work Log

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
