# Fire and Fellowship Captions — Full Build Playbook

**Purpose:** One script another bot (or future you) can follow to rebuild a similar multilingual live-caption PWA — what went right, what went wrong, and how it was corrected.

**Live app:** https://fire-fellowship-captions.onrender.com  
**Repo:** https://github.com/freddyja/fire-fellowship-captions  
**Saved skill:** Multilingual caption PWA playbook (generic recipe for any bot)

---

## Product that shipped

- Separate PWA (“Fire and Fellowship”), not the older handout app.
- Samsung Fold 7 as mic + control; TV shows EN | ES | PT captions.
- Send to TV (QR + copy link) and Smart View *mode* (Fold shows big caption UI for Samsung mirror).
- Topic of the day sheets (verse, italic Scripture, bold hook, teaching, Discussion Questions) in EN|ES|PT.
- Ask-for-topic generator; Captions-only toggle; Offline/Local meeting mode.
- Translators: **DeepL Free → MyMemory → MinT → mock**.
- Footer: Design by Freddy Jara-Almonte.
- README architecture diagram (`docs/architecture.png`).

---

## Timeline of major turns

### Right from the start
1. User clarified: **separate app**, branding Fire and Fellowship / Men’s Fellowship — **not** the other fellowship app.
2. Corrected course: canceled work on the wrong repo; new `fire-fellowship-captions` repo.
3. Same-session model: phone opens room + mic; TV opens display page; WebSocket sync.

### Speech & captions
4. Web Speech API on phone (zero STT key for demo).
5. Hide interim/draft lines — TV shows **finals only**.
6. Spoken language selector must drive STT locale **and** translate `from`.

### TV paths (big pain → clear product)
7. **Wrong:** In-app Smart View would list Samsung TVs / cast a separate page.  
   **Why:** Chrome Presentation API ≠ Samsung Smart View; Smart View only mirrors the phone screen.
8. **Right:**  
   - **Send to TV** = QR + copy link → TV’s own browser.  
   - **Smart View mode** = Fold switches to big caption layout while mic keeps running → user opens system Smart View.

### Layout / topic bugs fixed
9. Landscape Smart View showed one pane → CSS keep three EN|ES|PT panes.
10. Captions-only Smart View option.
11. Topic sheet blank in Preview Smart View → clipping / empty localized body; fix layout + EN fallback.
12. Trilingual topic band EN|ES|PT on TV + Smart View.
13. Topic tap format: verse, italic Scripture, bold hook, teaching, Discussion Questions.
14. Ask-for-topic (+ seed “head of household”); merge conflicts resolved before deploy.
15. Footer credit.

### Translators (the meeting-night cliff)
16. Google Cloud Translation blocked without billing admin → abandoned.
17. DeepL Free signup on bot computer repeatedly failed (forms/checkout) → shipped **MyMemory** as free default; DeepL path kept ready.
18. MyMemory daily quota exhausted (429) → silent fall to **mock dictionary** → free-form Spanish looked “untranslated” in English pane (mixed Spanish leftovers). Looked like a language-direction bug; root cause was **quota + weak fallback**.
19. Fix path: DeepL Free key obtained; pasted into **Render** env (`DEEPL_AUTH_KEY` / provider=deepl); **Save, rebuild, deploy** required (bot env alone is not enough). Secure paste forms failed on Render’s dynamic inputs → user paste on Fold or box handoff; must click Save.
20. MinT (Wikimedia) added as backup (PR #16): DeepL → MyMemory → MinT → mock. Merged and live.
21. Verified live free-form ES/PT/EN all directions with provider `deepl`.

### Deploy
22. Fly.io token / GitHub sudo on Fold failed → switched to **Render** free Web Service + GitHub. Live URL worked.
23. Free Render **cold starts** 30–60s (“Application loading”) after idle. Mitigations: wake 1–2 min early; laptop Local mode; paid always-on.

### Offline
24. Offline/Local meeting mode + laptop LAN/hotspot instructions for travel without public internet (mock translate).

### Docs
25. Architecture schematic generated; PR #17 merged into README “How it works”.

---

## What went wrong (catalog) → what corrected it

| Failure | Symptom | Root cause | Correction |
|--------|---------|------------|------------|
| Wrong repo | Features in unrelated handout app | Assumed one fellowship repo | New captions-only repo |
| Empty GitHub / Origin launch | Cloud agent couldn’t start | Empty repo / wrong host assumptions | Seed README commit; use GitHub + CloudAgent |
| Google Translate | Can’t enable API | No billing admin | Don’t depend on GCP billing |
| DeepL signup on bot PC | Empty fields / checkout loops | Headless + captcha friction | User signs up on Fold; secure key paste |
| MyMemory only | Mid-day “ES doesn’t translate” | Daily free quota → mock | DeepL primary + MinT backup; honest mock banner |
| Mock leftovers | EN pane shows Spanish words | Word-swap dictionary | Never use mock as silent production fallback |
| “Fixed” but still broken | Demo phrases work, free speech doesn’t | Testing only dictionary lines | Always test free-form ES/PT |
| Smart View button | No TV list / wrong screen | Wrong API for Samsung | Send to TV + Smart View mode |
| Mirror shows mic UI | Captions not on TV | Smart View mirrors phone | Switch phone to caption layout first |
| Landscape one pane | Only one language | Layout CSS | Force 3 columns/rows visible |
| Blank topic sheets | Labels only | Clipping / missing locale text | CSS + EN fallback |
| Interim spam | Draft captions on TV | Showing partial STT | Finals only |
| ES/PT source wrong | Other panes not translating | from/lang + provider identity | detectLang, pair translate, fallbacks, verify |
| Key “set” but site still MyMemory | Health still mymemory | Env not saved/redeployed on Render | Save, rebuild, deploy; confirm /health |
| Secure form fill fail | Key not landing in Render | Dynamic field refs | Box handoff or user pastes on phone |
| Slow app icon open | Long Render loading | Free instance sleep | Wake early / Local / always-on |
| Fly deploy | Token/sudo fail | Interactive auth on Fold | Render instead |

---

## What went right (keep doing)

1. Separate product + clear branding early.
2. Phone/TV same-host WebSocket room.
3. PWA install on Chrome (Fold).
4. Pluggable translators with **ordered fallbacks**.
5. Prefer TV browser over mirror when possible; document mirror honestly.
6. Ship in small PRs; auto-deploy from `main`.
7. Meeting UX: finals only, big type, 3 languages, topic sheet, captions-only.
8. Travel: Offline/Local mode.
9. Prove with live API + free-form speech, not vibes.
10. Capture architecture in README for the next human/bot.

---

## Script for another bot (copy/paste brief)

```
Build a SEPARATE installable PWA (not the user’s other fellowship app).
Name/branding: [NAME]. Phone = mic/control; TV = big EN|ES|PT captions.
Architecture: one Node host serves PWA + WebSocket room + /api/translate.
TV paths: (1) Send to TV QR/link to TV browser (2) optional Smart View MODE =
phone shows caption layout while mic runs; do NOT claim in-app Samsung cast.
Translators: DeepL Free (server key) → MyMemory → MinT → mock.
Never silent-mock in production; report real provider; banner only on mock.
Hide interim STT; finals only. Test free-form speech all six directions.
Topics: verse, italic Scripture, bold hook, teaching, Discussion Questions;
optional Ask-for-topic; trilingual sheet. Captions-only toggle. Footer credit.
Deploy: Render Web Service (or equivalent Node+WS), not static-only.
After secrets: Save + rebuild + deploy; confirm GET /health.
Document cold starts on free hosts. Add Offline/Local mode for travel.
README: architecture diagram + meeting-night runbook.
Ship via PRs; verify on live URL before declaring done.
```

---

## Meeting-night runbook (short)

1. Open the app ~2 minutes early (wake Render).
2. Fold Chrome / installed PWA → Create room → pick topic → Start mic.
3. Prefer **Send to TV** (TV browser). Or Smart View mode → system Smart View.
4. Confirm spoken language matches what’s spoken.
5. If panes look wrong: check health isn’t mock; hard-refresh; confirm DeepL still primary.

---

*Generated for Freddy Jara-Almonte from the Fire and Fellowship captions build (Sep 2026).*
