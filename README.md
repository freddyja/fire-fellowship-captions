# Fire Fellowship Captions

Live speech captions for **Men's Fellowship**. A phone captures the speaker; a TV (any browser) joins the same room and shows English, Spanish, and Portuguese windows.

This is a caption app only: no verse drawer, prayers, handouts, or marketing pages.

## Try it (two devices)

1. On the computer that will host the session:

   ```bash
   npm install
   npm run dev
   ```

2. Vite prints a local URL and a network URL. Chrome will warn about the self-signed HTTPS certificate — choose **Advanced → Proceed**. HTTPS is required so a real phone can use the microphone on the LAN.

3. **Phone (mic + control)**  
   Open the URL in Chrome. Tap **Create room on this phone**. Note the 4-letter room code. Tap the mic, allow microphone access, and speak.

4. **TV (big windows)**  
   On the TV browser, open the same host URL, enter the room code, tap **Open TV windows**.  
   Or from the phone, tap **Open TV view** / **Copy TV link**.

5. Speak on the phone. Captions should update on the TV in the selected layout:

   - One language, full-screen (huge type)
   - Dual columns (`EN | ES`, `EN | PT`, or `ES | PT`)
   - Triple columns (`EN | ES | PT`)

Same-computer dry run: create the room in one tab, open TV view in another.

HTTP-only laptop demo (mic works on `localhost`, not on a LAN IP):

```bash
npm run dev:http
```

## Mic tip

- Use **Chrome** (or Edge) on the phone. Safari/iOS and Firefox are weak or missing for Web Speech.
- Allow microphone permission when prompted.
- Keep the phone on the same Wi-Fi as the computer running `npm run dev`.
- Stand close to the phone; continuous recognition pauses in silence and then resumes.
- If the mic is blocked or unavailable, a type-to-send box appears so you can still drive the TV.

Demo lines that the built-in mock translator handles well:

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

## Scripts

```bash
npm run dev        # HTTPS (LAN phone mic)
npm run dev:http   # HTTP, localhost-friendly
npm run build
npm run preview    # same relay, production bundle
```

Both devices must use the **same host** that is running Vite. The realtime room is an in-memory WebSocket relay at `/caption-ws` inside the Vite server — nothing is stored, and there is no cloud account.
