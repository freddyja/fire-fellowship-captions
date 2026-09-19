# Fire Fellowship Captions

Live speech captions for **Men's Fellowship**, plus the **topic of the day**. A phone captures the speaker and chooses the meeting topic; a TV (any browser) joins the same room and shows the verse, a short handout, and English / Spanish / Portuguese caption windows.

This is one caption app. The topic list is a small built-in seed in this repo — not another product.

## Try it (two devices)

1. On the computer that will host the session:

   ```bash
   npm install
   npm run dev
   ```

2. Vite prints a local URL and a network URL. Chrome will warn about the self-signed HTTPS certificate — choose **Advanced → Proceed**. HTTPS is required so a real phone can use the microphone on the LAN.

3. **Phone (mic + control)**  
   Open the URL in Chrome. Tap **Create room on this phone**. Note the 4-letter room code.

   - Under **Topic of the day**, tap a topic (try **Brotherhood**) **or** type a topic / verse reference and tap **Set**.
   - The phone shows the verse and a short discussion prompt. That same content is sent to the TV.
   - Tap the mic, allow microphone access, and speak (or type a caption).

4. **TV (big windows)**  
   On the TV browser, open the same host URL, enter the room code, tap **Open TV windows**.  
   Or from the phone, tap **Open TV view** / **Copy TV link**.  
   You should see the topic, verse, and handout **above** the translation windows.

5. Speak on the phone. Captions should update on the TV in the selected layout:

   - One language, full-screen (huge type)
   - Dual columns (`EN | ES`, `EN | PT`, or `ES | PT`)
   - Triple columns (`EN | ES | PT`)

Same-computer dry run: create the room in one tab, open TV view in another.

HTTP-only laptop demo (mic works on `localhost`, not on a LAN IP):

```bash
npm run dev:http
```

## Topic of the day

Freddy sets the day’s Bible / Christian topic on the **phone**. The TV only displays it.

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

- Use **Chrome** (or Edge) on the phone. Safari/iOS and Firefox are weak or missing for Web Speech.
- Allow microphone permission when prompted.
- Keep the phone on the same Wi-Fi as the computer running `npm run dev`.
- Stand close to the phone; continuous recognition pauses in silence and then resumes.
- If the mic is blocked or unavailable, type a caption on the phone instead.

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

The phone owns the layout. The TV only displays it.

- **English / Español / Português** — one language, full-screen
- **EN \| ES**, **EN \| PT**, **ES \| PT** — dual columns
- **EN \| ES \| PT** — triple columns (default)

The topic band follows the same language layout as the caption windows.

## Scripts

```bash
npm run dev        # HTTPS (LAN phone mic)
npm run dev:http   # HTTP, localhost-friendly
npm run build
npm run preview    # same relay, production bundle
```

Both devices must use the **same host** that is running Vite. The realtime room is an in-memory WebSocket relay at `/caption-ws` inside the Vite server — nothing is stored, and there is no cloud account.
