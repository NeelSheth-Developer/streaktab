# StreakTab

**Build unstoppable daily streaks.** StreakTab is a Chrome extension that replaces your new tab with a personal dashboard for habits, reminders, trackers, and notes—so you stay on track every time you open a tab.

---

## Features

- **New tab dashboard** — Your custom home replaces the default Chrome new tab.
- **Daily streaks** — Track habits and build streaks with a simple, focused interface.
- **Custom trackers** — Create trackers with text and checkbox columns (e.g. fitness, goals) without spreadsheets.
- **Reminders** — Set date/time reminders with browser notifications and optional sound (including on any tab).
- **Notes** — Create notes with rich content and image paste; edit and delete easily.
- **Onboarding** — Quick setup with your name and age group for a personalized experience.
- **Settings** — Configure the extension to match how you work.

---

## Installation

1. **Clone or download** this repo:
   ```bash
   git clone https://github.com/NeelSheth-Developer/streaktab.git
   cd streaktab
   ```

2. **Load in Chrome**
   - Open `chrome://extensions`
   - Turn on **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the `streaktab` folder

3. **Open a new tab** — Your StreakTab dashboard will appear.

---

## Usage

- **Home** — Use the sidebar home icon to return to the main view.
- **Fitness / trackers** — Use the chart icon to create and manage custom trackers (e.g. workouts, habits).
- **Reminders** — Use the bell icon to add reminders; they fire as notifications (and optional sound) even when you’re on other sites.
- **Notes** — Use the document icon to create and edit notes with rich content.
- **Settings** — Use the gear icon to adjust preferences.

---

## Tech

- **Manifest V3** Chrome extension
- **Permissions:** `storage`, `alarms`, `notifications`, `offscreen`, `scripting`, `tabs`; host access for quotes API and fonts
- **Stack:** Vanilla JS, HTML, CSS; no build step required

---

## Project structure

| File / folder     | Purpose |
|-------------------|--------|
| `manifest.json`   | Extension config and permissions |
| `newtab.html`     | New tab page (dashboard UI) |
| `background.js`   | Service worker (alarms, storage, notifications) |
| `reminders.js`    | Reminders UI and logic |
| `reminder-sound.js` | Offscreen audio for reminder sounds |
| `content-reminder.js` | Injects reminder UI on any tab when a reminder fires |
| `tracker.js`      | Custom trackers (e.g. fitness) |
| `notes.js`        | Notes CRUD and rich content |
| `settings.js`     | Settings UI and persistence |
| `onboarding.js`   | First-run onboarding flow |
| `icons/`          | Extension and logo assets |
| `sounds/`         | Reminder sound assets |

---

## License

ISC

---

## Author

[NeelSheth-Developer](https://github.com/NeelSheth-Developer)
