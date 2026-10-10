# Nexus — Student OS

**Version:** v1.5.0 (beta)

Nexus is an all-in-one student organizer that keeps your school life in one
place: your class timetable, tasks, people, notes and money. It is built for
students who want to stay on top of deadlines and daily expenses without
juggling several apps or creating an account.

Everything is **local-first**. Your data is stored on your own device, with no
cloud account and no sign-up, so it works offline and stays private. Nexus runs
as a regular website and is also packaged with [Capacitor](https://capacitorjs.com)
as an installable Android app.

## What Nexus is for

- **Know your day at a glance.** The Home dashboard shows today's classes, what
  is due soon, upcoming events, birthdays, recent activity, your money on hand
  and a spending chart.
- **Never miss a class.** Build a Monday–Friday timetable and get a reminder
  before each class.
- **Keep up with schoolwork.** Track tasks and due dates, and jot down notes.
- **Remember the people in your life.** Keep contacts together with their
  birthdays.
- **Understand where your money goes.** Track accounts, income, expenses, loans
  and transfers, and see your spending broken down by category.
- **A greeting when you open the app.** Nexus says hello once each time it is opened (not again while it stays open, and not when you switch back to it). It uses the device's built-in speech with a soft, playful line and your name. To use your own clip instead, put an audio file at `www/assets/greeting.mp3` and it plays in place of the built-in voice. Switch it off in **Settings → Preferences → Greeting voice**.
- **Keep your logins safe.** A built-in password manager lives in Settings, and you can turn on an optional 4-digit PIN lock (**Settings → Security → App lock**) that asks for the PIN when Nexus opens and when you return after being away (immediately, 1 minute or 5 minutes). It keeps other people out of the app; it does not encrypt your data. Forgot the PIN? The only way back in is to erase the app's data from the lock screen.

## Features

| Area | What you can do |
| --- | --- |
| **Home** | Daily snapshot: classes, due tasks, events, birthdays, activity and spending chart |
| **Timetable** | Weekly class schedule with per-class reminders |
| **Tasks** | To-dos with due dates or no deadline. Unfinished tasks are listed first (soonest date first, then no-deadline tasks), finished ones last |
| **People** | Contacts with birthdays and ages |
| **Notes** | Quick notes |
| **Wallet** | Multiple accounts, income and expenses, loans, transfers, spending by category |
| **Settings** (☰ button in the top bar — slides in as a drawer over the current screen) | Themes and styles, name and school, currency, 12/24-hour time, reminders, spending options, backup (export/import), password manager and the optional app lock |

## What's new

### Starry Night and Dragon themes
Two more animated themes join Circuit. **Starry Night** paints a swirling night
sky with pulsing stars, a crescent moon and a village under a cypress. **Dragon**
covers the screen in dragon-hide scales with waves of fire rolling through them
and embers drifting up. Each animation runs only while its theme is selected.
Pick them in **Settings → Appearance → Theme**. The app icon is now a dragon,
and alternative icons to try are in `assets/icon-options/`.

### Circuit theme
A new **Circuit** theme brings the circuit-board look to Nexus: a dark green
board with copper and gold accents, translucent cards with small pad corners,
and an animated background of glowing traces with signals travelling along
them. The animation runs only while the theme is selected, so other themes use
no extra battery. Switch to it from **Settings → Appearance → Theme**.

### Custom spending categories
Spending is no longer limited to the built-in categories (Medical, Food, Snack,
Transportation, School Payment, Other). You can now add your own categories
with a name and a color, and use them when logging expenses. Deleting a custom
category never loses data: its spending is counted under Other.
Manage them in **Settings → Spending → Spending categories**.

### Auto-reset spending chart
The spending-by-category chart can now start fresh on a schedule: **every week
(Monday), every month or every year**, or never. A **Reset chart now** option
clears it on demand. Your transactions are never deleted, so the full history
stays in the Wallet and only the chart view resets. The chart shows the date
range it covers and when the next reset happens.
Set it up in **Settings → Spending**.

### Earlier updates
- **Timetable reminders** before each class, with a default lead time and
  per-class overrides. On Android they fire even when the app is closed.
- **Signed release builds** so each new Android version installs as an update
  over the previous one.
- **App icon and native launch screen** for the Android app.

## Your data and privacy

Classes, tasks, notes, wallet records, events and passwords are stored only in
this browser or app. Clearing site data, uninstalling the app or switching
devices can erase them, so use **Settings → Backup → Export** to keep a copy
and **Import** to restore it.

## Project layout

```
www/                         the app (served as-is by the browser and by Capacitor)
  index.html
  css/nexus.css
  fonts/  assets/
  js/
    main.js                  entry point: new App().start()
    core/                    App (composition root), Component (base class), Store, Toast,
                             OverlayManager (back button), ThemeManager, ModeManager, Shell,
                             BottomSheet, Dialog, TermsGate, NotificationService,
                             Util / Dom / Platform (static helpers), constants
    storage/                 MediaDB (IndexedDB), BackupService, ZipArchive, ZipWriter
    media/                   Thumbnails, Id3
    ui/                      ProgressCard, ListAnimator, Motion, Icons
    features/regular/        HomeView, TimetableView, EventsView, TasksView, PeopleView,
                             NotesView, WalletView, PasswordsView, SettingsView, SpendingService
                             (core/AppLock.js — optional PIN lock)
    features/chill/          ChillHome, MusicLibrary, AudioPlayer, NowPlaying, VideoPlayer,
                             ReadView, MangaReader, StoriesView, MediaImporter
    features/chill/manga/    MangaImporter, SeriesView, MangaModel
    backgrounds/             animated Circuit / Starry Night / Dragon theme backgrounds
tests/e2e/                   browser smoke test (Playwright) — `npm run test:e2e`
assets/                      app icon (icon.png) and icon-options/ to try later
package.json                 Capacitor and Local Notifications dependencies
capacitor.config.json
```

## Architecture

The code is organised as classes (ES modules), one class per file.

- **`App`** is the composition root. It creates one instance of every service and
  feature view, passes itself to each, and calls their `init()` in order.
- **`Component`** is the base class of everything stateful. A component reaches its
  collaborators as `this.app.<name>` (for example `this.app.toast.show(...)`,
  `this.app.audio.playChillTrack(i)`) and the saved data as `this.state`. Methods are
  auto-bound, so they can be passed around as callbacks safely.
- **Services** (`Store`, `Toast`, `OverlayManager`, `MediaDB`, `BackupService`, …) own
  one concern and its state. **Feature views** (`TasksView`, `MangaReader`, …) own one
  screen: its `init()` wires the DOM, its `draw…()` methods render.
- **Static helper classes** (`Util`, `Dom`, `Icons`, `Platform`, `MangaModel`, `Id3`,
  `ZipWriter`) hold pure functions with no state; **`constants.js`** holds shared data.

To add a feature: create a class that extends `Component` in `js/features/…`, then add
one line to `App`'s constructor (`this.myFeature = new MyFeature(this);`). It will be
initialised automatically.

## Tests

`npm run test:e2e` drives the real UI in headless Chromium (about 40 checks: every
screen, add/edit/delete flows, music, video and manga import with the progress card,
the manga reader's page turns, backup export/restore and wipe). Install once with
`npm install` and `npx playwright install chromium`.
