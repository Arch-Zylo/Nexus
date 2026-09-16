# Nexus — Student OS

A local-first student planner (timetable, tasks, people, notes, wallet,
password manager) that runs as a normal website and is now wrapped with
[Capacitor](https://capacitorjs.com) so it can be built into an installable
Android APK — automatically, via GitHub Actions. No Android Studio needed.

## What's in here

```
www/                        the actual app (unchanged UI/logic, now with reminders)
  index.html
  nexus.css
  nexus.js
package.json                Capacitor + Local Notifications dependencies
capacitor.config.json       app id / name / web folder
.github/workflows/build-apk.yml   builds a debug APK on every push
```

The `android/` native project is **not** committed — the workflow generates
it fresh on every run (`npx cap add android`), so there's nothing stale to
merge-conflict on.

## 1. Push this to GitHub

```bash
git init
git add .
git commit -m "Nexus — ready for Android build"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 2. Get the APK

Push to `main` (or open a PR, or run it manually) and GitHub Actions takes
it from there:

1. Go to the repo's **Actions** tab.
2. Open the latest **Build Android APK** run.
3. Download the **nexus-debug-apk** artifact — that's `app-debug.apk`.
4. Copy it to an Android phone and install it (you may need to allow
   "install from unknown sources" for your file manager/browser once).

This is a *debug*-signed APK, which is installable on any device but not
meant for the Play Store. If you eventually want a Play-Store-ready release
build, you'll need to generate a signing keystore and add it as GitHub
Secrets (`RELEASE_KEYSTORE`, `RELEASE_KEYSTORE_PASSWORD`, etc.), then swap
`assembleDebug` for `assembleRelease` in the workflow — ask if you want that
wired up.

## 3. Timetable notifications

Nexus can now remind you before each class:

- **Settings → Preferences → Timetable reminders** — turns reminders on/off
  (asks for notification permission the first time).
- **Settings → Preferences → Default reminder time** — tap to cycle through
  5 / 10 / 15 / 30 / 60 minutes before class. This is the default used by
  any class that doesn't set its own.
- **Timetable → + Class (or edit a class)** — each class has its own
  "Remind me before this class" checkbox and a reminder-time dropdown, so
  you can silence a specific class or give it a different lead time than
  the default.

Reminders repeat weekly on each class's day, and — once installed as the
Android app — keep firing even when the app is closed, using
`@capacitor/local-notifications` (real scheduled OS notifications, not just
a browser tab timer). If you open `www/index.html` directly in a desktop
browser instead of installing the APK, reminders still work as a
best-effort fallback using the Web Notification API, but only while that
tab stays open.

## 4. App icon & splash screen

- **App icon** — `assets/icon.png` (the "A" mark) is the single source
  image. The workflow runs `npx capacitor-assets generate --android`
  right after the Android platform is added, which generates every
  launcher-icon density/shape (legacy + adaptive) from that one file —
  nothing to configure by hand. To change the icon later, just replace
  `assets/icon.png` and push.
- **Native launch screen** — the build does not configure a custom
  native Android splash/launch screen. The APK shows Android's default
  minimal launch screen (or none) and goes straight into the web
  content.
- **In-app splash** — `www/assets/phoenix.png` is shown full-screen for a
  moment when the app opens, with the "Nexus" wordmark and a small
  "developed by Axis Inc." line beneath it, before fading into the app
  itself. This is plain HTML/CSS/JS (see `#nexusSplash` in `index.html`,
  its styles in `nexus.css`, and `hideSplash()` in `nexus.js`), so
  wording, timing, or styling can be tweaked directly without touching
  any native code.

## Local development / previewing changes before building

You can just open `www/index.html` in a browser to preview UI/logic
changes — it's a static site with no build step. When you're happy with
changes, commit and push; the workflow rebuilds the APK automatically.

If you want to run the Capacitor commands yourself locally instead of
relying on Actions (requires Node.js and a JDK installed):

```bash
npm install
npx cap add android
npx cap sync android
cd android
./gradlew assembleDebug
# APK lands in android/app/build/outputs/apk/debug/app-debug.apk
```
