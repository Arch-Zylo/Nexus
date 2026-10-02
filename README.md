# Nexus — Student OS

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
- **Keep your logins safe.** A built-in password manager lives in Settings.

## Features

| Area | What you can do |
| --- | --- |
| **Home** | Daily snapshot: classes, due tasks, events, birthdays, activity and spending chart |
| **Timetable** | Weekly class schedule with per-class reminders |
| **Tasks** | To-dos with due dates |
| **People** | Contacts with birthdays and ages |
| **Notes** | Quick notes |
| **Wallet** | Multiple accounts, income and expenses, loans, transfers, spending by category |
| **Settings** | Themes and styles, name and school, currency, 12/24-hour time, reminders, spending options, backup (export/import) and password manager |

## What's new

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
www/                 the app
  index.html
  nexus.css
  nexus.js
  circuit-bg.js      animated Circuit theme background
  assets/
package.json         Capacitor and Local Notifications dependencies
capacitor.config.json
```
