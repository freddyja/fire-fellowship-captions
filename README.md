# Fire Fellowship Captions

Live speech captions for **Men's Fellowship**, plus the **topic of the day**. A phone captures the speaker and chooses the meeting topic; a TV (any browser) joins the same room and shows the verse, a short handout, and English / Spanish / Portuguese caption windows.

This is one caption app. The topic list is a small built-in seed in this repo — not another product.

## Try it (Fold + TV)

Freddy’s usual setup: **Samsung Galaxy Z Fold 7 (Chrome on Android)** as mic + control, and a **TV browser** for the big windows.

1. On the computer that will host the session:

   ```bash
   npm install
   npm run dev
   ```

2. Vite prints a local URL and a **Network** URL. On the Fold, open that Network URL in **Chrome** (not Samsung Internet). Chrome will warn about the self-signed HTTPS certificate — **Advanced → Proceed**. HTTPS is required so the Fold can use the microphone.

3. **Fold (mic + control)**  
   Tap **Create room on this phone**. Note the 4-letter room code. Unfolded inner screen uses two columns; the cover screen keeps a large mic in the thumb zone.

   - Under **Topic of the day**, tap a topic (try **Brotherhood**) **or** type a topic / verse reference and tap **Set**.
   - The Fold shows the verse and a short discussion prompt. That same content is sent to the TV.
   - Tap the mic, allow microphone access, keep **Chrome in the foreground**, and speak (or type a caption).

4. **TV (big windows)**  
   On the TV browser, open the same host URL, enter the room code, tap **Open TV windows**.  
   Or from the Fold, tap **Copy TV link** and open it on the TV.  
   You should see the topic, verse, and handout **above** the translation windows.

5. Speak on the Fold. Captions should update on the TV in the selected layout:

   - One language, full-screen (huge type)
   - Dual columns (`EN | ES`, `EN | PT`, or `ES | PT`)
   - Triple columns (`EN | ES | PT`)

Same-computer dry run: create the room in one tab, open TV view in another.

HTTP-only laptop demo (mic works on `localhost`, not on a LAN IP):

```bash
npm run dev:http
```

## Galaxy Z Fold 7 + Chrome

Web Speech on Android is reliable in **Chrome**. Samsung Internet, Firefox, and in-app browsers usually will not capture live speech.

- Open the session in **Chrome** on the Fold (cover or unfolded inner screen).
- Use the **Network** HTTPS URL from `npm run dev`, then **Advanced → Proceed** on the certificate warning, then **Allow** the microphone.
- Keep Chrome in the foreground while speaking. If the screen sleeps or you switch apps, tap **Start** again.
- Unfolded: topic + mic on one side, language / TV layout / captions on the other. Comfortable tap targets (at least 48px).
- Cover screen: same controls, stacked, with the mic docked in the thumb zone.
- Flex / book-stand: columns follow the two screen segments when Chrome reports them.
- Same Wi-Fi as the computer running Vite. Stand the Fold near the speaker.

## Topic of the day

Freddy sets the day’s Bible / Christian topic on the **Fold**. The TV only displays it.

**Pick:** tap a built-in topic under **Topic of the day** (Brotherhood, Integrity, Courage, Work, Self-control, Forgiveness, Humility, Accountability, Servant leadership, Faith in trials).

**Insert / search:** type a name or reference and tap **Set**. Examples that resolve to seed data:

- `brotherhood`
- `iron`
- `Proverbs 27:17`
- `Joshua 1:9`

If nothing matches, the typed title still goes to the TV with a short generic discussion prompt (no verse until you pick a seeded topic). Tap **None** to clear it.

Seed verses and prompts are English, Spanish, and Portuguese. The TV shows the languages of the current caption layout. Custom titles stay in the text you typed, with room in the data to add translations later.

To add or edit the built-in set, change `src/topics.ts` (offline, no API keys).

## Mic tip

- Use **Chrome** on the Fold. Do not use Samsung Internet for the mic.
- Allow microphone permission when prompted.
- Keep the Fold on the same Wi-Fi as the computer running `npm run dev`.
- Stand close; continuous recognition pauses in silence and then resumes.
- If the mic is blocked or unavailable, type a caption instead.

Demo line that the built-in mock translator handles well:

> Welcome brothers. Thank you for coming tonight. Let us begin.

## Translation / env

Copy `.env.example` to `.env` if you want to change providers. **Never commit secrets.**

| `VITE_TRANSLATE_PROVIDER` | Behavior |
| --- | --- |
| `mock` (default) | Built-in EN/ES/PT dictionary. Works offline, no keys. |
| `passthrough` | Copies the spoken text into every window. |
| `mymemory` | Free public API, no key, rate-limited, needs network. |
| `libretranslate` | Uses `VITE_LIBRETRANSLATE_URL` and optional `VITE_LIBRETRANSLATE_API_KEY`. |

Speech-to-text is the Web Speech API on the phone (`src/stt/web-speech.ts`). Translation is pluggable in `src/translate/` so a cloud STT/MT provider can be dropped in later.

## Layouts (phone control → TV)

The Fold owns the layout. The TV only displays it.

- **English / Español / Português** — one language, full-screen
- **EN \| ES**, **EN \| PT**, **ES \| PT** — dual columns
- **EN \| ES \| PT** — triple columns (default)

The topic band follows the same language layout as the caption windows.

## Scripts

```bash
npm run dev        # HTTPS (LAN Fold mic)
npm run dev:http   # HTTP, localhost-friendly
npm run build
npm run preview    # same relay, production bundle
```

Both devices must use the **same host** that is running Vite. The realtime room is an in-memory WebSocket relay at `/caption-ws` inside the Vite server — nothing is stored, and there is no cloud account.
