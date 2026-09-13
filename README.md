# MoCo Fill Month

> Fill a whole month of [MoCo](https://www.mocoapp.com/) time entries with one
> click — visible instantly in the web app and the Android app.

A small Tampermonkey userscript that adds a floating **Fill month** button to
the MoCo web app. It plans a whole month of workdays, previews everything, then
creates all entries in a single request via MoCo's **official REST API**
(`POST /api/v1/activities/bulk`) — the same API MoCo's own integrations use.
No decompiling, no scripts on your machine, no third-party servers.

---

## ✨ Features

- **One month, one click** — a full month of entries, posted in a single bulk
  request
- **Plan before you commit** — every date and hour is previewed; nothing is
  created until you confirm twice
- **Weekday-aware** — per-day hours (default `8,8,8,8,8,0,0` = Mon–Fri, weekends
  off)
- **Holiday-aware** — exclude specific dates with a simple comma-separated list
- **Safe re-runs** — optional "replace existing entries" for the chosen
  month/project/task
- **No fragile DOM hooks** — a floating button + own dialog, so MoCo app
  updates can't break it
- **Android-ready** — runs in Kiwi Browser or Firefox for Android

---

## 🔑 Before you start: get your API key

1. Log in to **mocoapp.com** → click your **profile picture** (top right).
2. Open **Integrations** — your personal key is there.
3. Copy it. It's shown **once** — treat it like a password; anyone with it can
   edit your time entries.

---

## 📦 Install

### Desktop (Chrome / Edge / Firefox)

1. Install **[Tampermonkey](https://www.tampermonkey.net/)** from your
   browser's official extension store.
2. Open the Tampermonkey dashboard → **Utilities** → *File → Import* → select
   **`moco_fill_month.user.js`** from this repo.
3. Enable the script and reload mocoapp.com.

### Android

1. Install **[Kiwi Browser](https://kiwibrowser.com/)** (Play Store) — a
   Chromium browser that supports extensions.
2. Install the **Tampermonkey** extension inside Kiwi, then import the script
   exactly as above.
3. Alternative: **Firefox for Android** + **Violentmonkey**.

### Updating

Open the Tampermonkey dashboard → *MoCo Fill Month Button* → replace the code
with the newest file from this repo → **Ctrl+S** → reload mocoapp.com.

---

## 🚀 First run

1. Click the blue **Fill month** button (bottom-right of the web app).
2. Click **change** next to *Key: not set*, paste your API key, and confirm.
3. The key is stored **only in your browser's extension storage** — never sent
   anywhere except directly to MoCo's API.

---

## 🕹️ Usage

| Field | What it does |
|---|---|
| **Month** | `YYYY-MM` to fill (defaults to the current month) |
| **Project / Task** | Dropdowns loaded live from your account |
| **Hours per weekday** | Mon, Tue, … Sun — `0` = skip that day |
| **Describe your work** | One description used on every entry (optional) |
| **Skip dates** | Dates to exclude, comma-separated, e.g. `2026-09-25, 2026-09-28` |
| **Replace existing entries** | Deletes that month's entries for this project/task first, then adds the new ones |

1. Pick the month, project and task.
2. Review the hours and description.
3. Click **Preview** — a full list of dates with hours and the month total is
   shown.
4. The button changes to **Create N entries? Click again to confirm** — click
   it a **second time** to actually create them.
5. Use **Reload page** and your time sheet shows all entries.

> Nothing is ever created by Previewing or by the first click — only the
> explicit second click posts data.

---

## 🛡️ Safety & limits

- **Only adds by default.** Existing entries are never touched unless you tick
  *Replace existing entries*.
- **Replace scope** is limited: only entries matching the same month, project
  and task are deleted. Entries elsewhere are always safe.
- **Billed/locked entries can't be modified** — MoCo's API rejects them (you'll
  see the error in the dialog). Fill ahead of billing, not after.
- Entries are created with `seconds` (hours × 3600), the exact same data model
  the web app uses, so they show up everywhere immediately.

---

## ❓ FAQ

**Is this official?**
It uses MoCo's documented public API with your own personal key. The tool is
**not** made or endorsed by MoCo — it's a personal productivity helper.

**Why not modify the app directly?**
MoCo is a hosted service: the tracking logic runs on their servers and the app
is updated constantly. Anything "decompiled" or patched locally would be wiped
on the next deploy. The API is the supported, durable way to do this.

**Does it work for my company?**
Yes — it runs on any `*.mocoapp.com` instance.

---

## 🔧 Troubleshooting

| Symptom | Fix |
|---|---|
| No "Fill month" button | Script not enabled / not re-imported after an update; hard-reload (Ctrl+F5). Must be on a `*.mocoapp.com` page. |
| Red message with `401` | API key wrong or regenerated — use *change* and paste the new key. |
| Projects don't load | Key lacks permission for the project, or the project is archived. |
| "Billed" errors | Those entries are locked for billing — fill earlier in the month instead. |

---

## ⚖️ License

[MIT](LICENSE)

*Unofficial tool. MoCo may change its app or API at any time — if the button
stops appearing, re-import the latest version.*
