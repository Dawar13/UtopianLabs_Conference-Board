# Utopian Labs conference board

A one-page board of the conferences the lab is targeting. Anyone with the link can view it without signing in. Only someone with the edit password can change it. Edits save automatically to a small Redis store on Vercel.

## Deploy on Vercel

1. Put this folder in a GitHub repository (private is fine).
2. In Vercel, add a new project and import that repository. Choose the framework preset **Other** and leave the build command and output directory empty. Deploy.
3. Connect storage. In the project, open **Storage** (or the Marketplace), add **Upstash for Redis** (the free plan is plenty) and connect it to this project. Vercel adds the connection variables for you, either `KV_REST_API_URL` and `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. The code reads either pair.
4. In **Settings > Environment Variables**, add `EDIT_PASSWORD` with a long passphrase (20 characters or more). Tick Production, and Preview if you use preview links.
5. Redeploy so the new variables take effect.
6. Open the site, choose **Edit** and enter the password. Until the first save, visitors see the starting data in `data/seed.json`.

Dashboard menu names on Vercel sometimes move; the steps stay the same.

## Using the board

**Everyone**
- The top of the page shows the next deadline with a countdown, and the four after it.
- Click a colour in the key to show only those rows. Click a paper tag to show only rows with that paper. Use the search box for anything else.
- **Download CSV** gives a copy that opens in Excel.

**Editing (owner only)**
- Click a cell to select it. Click it again, press Enter, or start typing to edit. Double-click also works.
- Enter saves and moves down. Shift+Enter (or Alt+Enter) starts a new line inside the cell. Tab moves right. Esc cancels.
- Arrow keys move around. Delete clears a cell. Ctrl+Z undoes, Ctrl+Y redoes, Ctrl+B makes a cell bold. Copy and paste work on the selected cell.
- **Papers** is a tags column: type a paper name and press Enter to add it; Backspace in the empty box removes the last tag; the x on a tag removes it. Names you have used before are suggested.
- Each column header has a menu: rename, switch between text and tags, insert a column left or right, move it, delete it. Drag the right edge of a header to change its width.
- Each row number has a menu: row colour, insert above or below, duplicate, move, delete.
- The toolbar has row colour, cell colour, bold, add row, add column, and **Colour key** (what each colour means).
- Click the board title to rename it.

**Deadlines that count down by themselves**
Write a date in any text cell like `5 Dec 2026, 23:59 AoE` (or `... UTC`). The board then shows the IST time under it, a days-left label, crosses it out once it passes, and puts it in the countdown at the top. The line just above the date is used as its label (for example "Full paper").

**Bold text inside a cell**: wrap it in double stars, like `**Full paper**`.

**Saving**: every change saves about a second later; the toolbar shows "All changes saved". If the board was changed from another device in the meantime, the page asks you to reload instead of overwriting the newer version.

## Security

- Viewing needs nothing. Every save is checked on the server against `EDIT_PASSWORD`; the page alone cannot change the stored board.
- After 10 wrong passwords from one network in 15 minutes, further attempts are refused for 15 minutes.
- "Keep me signed in on this device" stores the password in that browser. Untick it on shared computers.
- To change the password, change `EDIT_PASSWORD` in Vercel and redeploy. Devices with the old password are signed out at their next save.

## Backups and reset

- Every save keeps the previous version in the Redis list `conference-board:v1:history` (the last 50). To roll back, open the Upstash data browser, copy an entry from that list and set it as the value of `conference-board:v1`.
- To start again from `data/seed.json`, delete the key `conference-board:v1`.
- Downloading the CSV now and then is a simple extra backup.

## Local preview

```
node scripts/dev.js
```

Then open http://localhost:3000. The edit password is `change-me`, and the data lives in memory until you stop it.

## Files

- `index.html`: the whole page (layout, editing, countdowns).
- `api/data.js`: reads the board (anyone) and saves it (password needed).
- `api/auth.js`: checks the edit password.
- `api/_lib.js`: Redis access, password check and lockout.
- `data/seed.json`: the starting board.
- `vercel.json`: security headers.
- `scripts/dev.js`: local preview server (not deployed).
