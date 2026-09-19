# Fire and Fellowship Captions

Live speech captions for **Men's Fellowship**, plus the **topic of the day**. A phone captures the speaker and chooses the meeting topic; a TV (any browser) joins the same room and shows the verse, a short handout, and English / Spanish / Portuguese caption windows.

This is one caption app. The topic list is a small built-in seed in this repo — not another product.

**Meeting night shape:** install **Fire and Fellowship** on the Galaxy Z Fold 7 from a public HTTPS URL (Chrome → Install app). Open the same URL on the TV. No git, no `npm run dev`.

## Install on the Fold (Chrome on Android)

Freddy’s phone: **Samsung Galaxy Z Fold 7**, **Chrome** (not Samsung Internet). Web Speech and Add to Home Screen are reliable in Chrome.

1. Deploy once (see [Host a public URL](#host-a-public-url)) so you have an `https://…` link.
2. On the Fold, open that URL in **Chrome**.
3. Install like a normal app:
   - If the page shows **Install app**, tap it and confirm.
   - Or tap Chrome’s menu **⋮ → Install app** / **Add to Home screen**.
4. Open **Fire and Fellowship** from the home-screen icon. It should launch **standalone** (no Chrome address bar).
5. Tap **Create room on this phone**. That phone/control + mic route is the same PWA — it stays in the installed app.

Keep Chrome (or the installed PWA, which is Chrome) in the **foreground** while speaking. Allow the microphone when asked.

## Open on the TV (meeting night)

The TV is a display. Any browser on the TV (or a laptop HDMI’d to the TV) is fine.

1. On the Fold app, note the 4-letter room code (or tap **Copy TV link**).
2. On the TV browser, open the **same public URL**.
3. Enter the room code and tap **Open TV windows**, or paste the copied TV link (`/?view=tv&room=ABCD`).
4. On the Fold, pick **Topic of the day** (try **Brotherhood**) or type a topic / verse and tap **Set**. The TV should show the verse and handout above the caption windows.
5. Tap the mic on the Fold and speak (or type a caption). Captions should appear on the TV in the layout you chose:
   - One language, full-screen
   - Dual columns (`EN | ES`, `EN | PT`, or `ES | PT`)
   - Triple columns (`EN | ES | PT`)

Phone and TV must use the **same public host**. The room lives in memory on that one server — nothing is stored, and there is no account.

## Host a public URL

### Chosen deploy shape: one Node process

The app is a Vite frontend plus an in-memory WebSocket relay at `/caption-ws` (`server/relay.ts`). Phone and TV stay in sync only if they connect to the **same process**.

Production is therefore **one small Node server** (`server/index.ts`) that:

- Serves the built PWA from `dist/` (HTTPS is terminated by the host)
- Attaches the same relay used in `npm run dev`
- Exposes `GET /health` for the host’s checks

```bash
npm install
npm run build
npm start          # PORT=8080 HOST=0.0.0.0 by default
```

**Keep exactly one instance.** Two replicas (or two serverless isolates) mean the Fold and the TV can land on different memories and never see each other.

**Why not Vercel alone?** Vercel Functions can speak WebSockets, but a new connection is not guaranteed to reach the same isolate, and Hobby connections close at the function time limit (minutes, not a whole meeting). Making that work needs an external pub/sub (Redis, etc.). This repo does not fake that. A single Fly / Railway / Render process is the reversible path.

Split hosting (static files on one CDN + a durable websocket box) would also work if you pointed the browser at one origin; it is more moving parts than Freddy needs.

### Fly.io (preferred default)

Cheap, HTTPS, WebSockets, scale-to-zero when idle.

1. Install the [Fly CLI](https://fly.io/docs/flyctl/install/) and run `fly auth login`.
2. From this repo:

   ```bash
   fly launch --ha=false --copy-config --yes
   fly deploy --ha=false
   fly scale count 1
   ```

3. If the app name `fire-fellowship-captions` is taken, change `app` in `fly.toml` (or the name `fly launch` prints) and deploy again.
4. Fly prints `https://<app>.fly.dev`. That is the meeting-night URL.

`fly.toml` is set to **one 256 MB machine**, `force_https`, and `/health`. `auto_stop_machines = "stop"` sleeps when idle (first open after a pause can take a few seconds). To avoid a cold start on meeting night, either open the URL a minute early or set `min_machines_running = 1` for the evening.

Do not deploy mid-meeting (a new machine can drop the in-memory room).

### Railway

1. New project → deploy this repo.
2. Railway should pick up `railway.toml` + `Dockerfile` (`npm run build` then `npm start`).
3. Generate a public HTTPS domain in the service settings.
4. Replicas: **1**. Railway injects `PORT`; do not add secrets for the default mock translator.

### Render

1. New **Web Service** (not a Static Site) from this repo, or apply `render.yaml`.
2. Build `npm ci && npm run build`, start `npm start`, Node 22.
3. Free instances sleep; open the URL a minute before the meeting.
4. Instance count: **1**.

### After you have the URL

Install on the Fold ([above](#install-on-the-fold-chrome-on-android)). Bookmark the same URL on the TV browser if you want.

No Play Store APK. Chrome’s installed PWA is the app format.

## Verify phone + TV in the production shape

After `npm run build`, either locally or against the public URL:

```bash
npm run verify:prod
npm run verify:prod -- https://YOUR-APP.fly.dev
```

The script checks:

- `/health` is OK
- `/` and `/?view=phone&room=ABCD` / `/?view=tv&room=ABCD` serve the app shell (so the home-screen icon can open both routes)
- Manifest: name **Fire and Fellowship**, short name, standalone, theme, 192/512 icons
- Service worker registers a `fetch` handler and does not intercept `/caption-ws`
- Two WebSocket clients in room `ABCD`: a phone **topic of the day** push arrives on the TV

**Meeting-night dry run on the real URL**

1. Fold (installed app or Chrome): create a room, set topic **Brotherhood**.
2. TV: open the TV link. Confirm verse / handout above the windows.
3. Type `Welcome brothers. Thank you for coming tonight. Let us begin.` on the Fold (or speak). Confirm captions on the TV.
4. Status pills: Fold shows **TV connected**; TV shows **Phone connected**.

If the TV stays on **Waiting for phone**, you are on two different hosts or more than one server instance.

## Topic of the day

Freddy sets the day’s Bible / Christian topic on the **Fold**. The TV only displays it. This is unchanged in production: the phone pushes room state over the relay, including `topic`.

**Pick:** tap a built-in topic (Brotherhood, Integrity, Courage, Work, Self-control, Forgiveness, Humility, Accountability, Servant leadership, Faith in trials).

**Insert / search:** type a name or reference and tap **Set**. Examples that resolve to seed data:

- `brotherhood`
- `iron`
- `Proverbs 27:17`
- `Joshua 1:9`

If nothing matches, the typed title still goes to the TV with a short generic discussion prompt (no verse until you pick a seeded topic). Tap **Clear** to remove it.

Seed verses and prompts are English, Spanish, and Portuguese. The TV shows the languages of the current caption layout. To add or edit the built-in set, change `src/topics.ts` (offline, no API keys).

## Galaxy Z Fold 7 + Chrome

- Open (or install) in **Chrome**. Samsung Internet, Firefox, and in-app browsers usually will not capture live speech or offer a solid install.
- Allow microphone access. Keep the app in the foreground. If the screen sleeps or you switch apps, tap **Start** again.
- Unfolded: topic + mic on one side, language / TV layout / captions on the other.
- Cover screen: same controls, stacked, with the mic docked in the thumb zone.
- Flex / book-stand: columns follow the two screen segments when Chrome reports them.
- Stand the Fold near the speaker.

## Mic tip

- Use **Chrome** or the Chrome-installed PWA. Do not use Samsung Internet for the mic.
- Allow microphone permission when prompted.
- Stand close; continuous recognition pauses in silence and then resumes.
- If the mic is blocked or unavailable, type a caption instead.

Demo line that the built-in mock translator handles well:

> Welcome brothers. Thank you for coming tonight. Let us begin.

## Translation / env

Copy `.env.example` to `.env` if you want to change providers **before** `npm run build`. Vite inlines `VITE_*` at build time. **Never commit secrets.** The default (`mock`) needs no keys.

| `VITE_TRANSLATE_PROVIDER` | Behavior |
| --- | --- |
| `mock` (default) | Built-in EN/ES/PT dictionary. Works offline, no keys. |
| `passthrough` | Copies the spoken text into every window. |
| `mymemory` | Free public API, no key, rate-limited, needs network. |
| `libretranslate` | Uses `VITE_LIBRETRANSLATE_URL` and optional `VITE_LIBRETRANSLATE_API_KEY`. |

Speech-to-text is the Web Speech API on the phone (`src/stt/web-speech.ts`). Translation is pluggable in `src/translate/`.

## Layouts (phone control → TV)

The Fold owns the layout. The TV only displays it. The topic band follows the same language layout as the caption windows.

## Scripts

```bash
npm run dev          # HTTPS Vite + relay (LAN Fold mic, self-signed cert)
npm run dev:http     # HTTP, localhost-friendly
npm run build        # typecheck + production bundle
npm start            # production server: static PWA + relay (use after build)
npm run preview      # Vite preview + same relay (local production bundle)
npm run verify:prod  # PWA + relay checks (optional public URL argument)
```

Local LAN Fold testing still works with `npm run dev` (Chrome will warn about the self-signed certificate — **Advanced → Proceed**). Meeting night should use the public HTTPS URL so there is no laptop in the loop.

## PWA notes

- Manifest: **Fire and Fellowship** name and short name, standalone display, theme `#120c09`, 192/512 (any + maskable) icons.
- Service worker: offline app shell (HTML/CSS/JS/icons/fonts after first load). Live captions still need the network so the relay can reach the TV.
- `start_url` is `/`. Phone and TV are query routes (`/?view=phone&room=ABCD`, `/?view=tv&room=ABCD`) inside that scope, so both work from the installed icon and from copied links.
