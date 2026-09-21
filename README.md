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
.github/workflows/build-apk.yml   builds a self-signed release APK on every push
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

## 1b. One-time: add your signing keystore as GitHub Secrets

The workflow builds a **release** APK signed with your own keystore (not
Android's shared debug key), so every build you download is signed with the
same certificate and installs as an update over the last one instead of
being rejected as a "different app."

Add these four repo secrets — **Settings → Secrets and variables → Actions
→ New repository secret**:

| Secret name                  | Value                                              |
|-------------------------------|-----------------------------------------------------|
| `ANDROID_KEYSTORE_BASE64`     | The keystore file, base64-encoded (see below)       |
| `ANDROID_KEYSTORE_PASSWORD`   | The keystore's store password                       |
| `ANDROID_KEY_ALIAS`           | The key alias inside the keystore                   |
| `ANDROID_KEY_PASSWORD`        | The key's password (often same as store password)   |

If you already have a `nexus-release.keystore` (Claude can generate one for
you), base64-encode it for the secret value:

```bash
base64 -w0 nexus-release.keystore > nexus-release.keystore.b64
# paste the contents of nexus-release.keystore.b64 as ANDROID_KEYSTORE_BASE64
```

**Keep the keystore file and its passwords somewhere safe outside the
repo** (a password manager, a private backup) — losing them means future
signed builds can never update your installed app again, and you'd have to
uninstall/reinstall with a new keystore. The keystore is never committed to
git; the workflow decodes it from the secret fresh on every run.

## 2. Get the APK

Push to `main` (or open a PR, or run it manually) and GitHub Actions takes
it from there:

1. Go to the repo's **Actions** tab.
2. Open the latest **Build Android APK** run.
3. Download the **nexus-release-apk** artifact — that's `app-release.apk`.
4. Copy it to an Android phone and install it (you may need to allow
   "install from unknown sources" for your file manager/browser once).

This is signed with your own key from step 1b, not Android's shared debug
key — Google Play Protect is far less likely to flag it, and later builds
install as clean updates over earlier ones instead of conflicting.

**One-time switch-over note:** if you already have a *debug*-signed Nexus
APK installed (from before this change), installing the new release-signed
one will fail with a signature-mismatch error, since Android treats a
different signing key as a different app. Export a backup first (Settings
→ Backup → Export), uninstall the old debug build, install the new
release APK, then import the backup back in. Every build after that
updates cleanly in place, since they all share the same keystore.

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
- **Splash screen** — there is no in-app (HTML/CSS/JS) splash anymore;
  the app goes straight to the Terms gate (first run) or the Home view.
  The only splash left is the native Android one configured by the
  "Configure native Android launch screen" step in the build workflow,
  which shows briefly while the APK's WebView is still loading.

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

Note: this local `assembleDebug` build uses Android's shared debug key, not
the release keystore from step 1b, so it won't install as an "update" over
a release APK from Actions (or vice versa) on the same device — Android
treats them as different apps until you uninstall one. For a local build
signed the same way as CI, drop your `nexus-release.keystore` into
`android/app/`, export the same four values as environment variables, and
run `./gradlew assembleRelease` instead — see `build-apk.yml`'s "Configure
release signing" step for the exact `signingConfigs` block it injects.
