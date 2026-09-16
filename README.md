# 🍊 Yuzu

**Pain travels one way. Comfort travels back.**

She's in Pune. He's in Berlin. When her cramp starts, his phone starts buzzing
and won't stop. He never sees what she wrote — only a hint. He has **5 tries**
to work out what she needs. Only she can make it stop. If he fails, she gets to
hit back, and every punch fires his phone.

Room codes are **Cuddle Codes**. Installable as an app. 🍊

---

## Just want to see it? (zero setup)

```bash
open prototype/index.html
```

Both phones side by side, no server, no keys.

---

## Run the real app

### 1. Install
```bash
npm install
```

### 2. Supabase (login + live sync)
1. New project at [supabase.com](https://supabase.com)
2. **SQL Editor** → paste `supabase/schema.sql` → **Run**
3. **Authentication → Providers → Google** → enable, add your Google OAuth client
4. **Authentication → URL Configuration → Redirect URLs** → add:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-APP.vercel.app/auth/callback`
5. **Settings → API** → copy the Project URL and the `anon` key

### 3. Web Push (buzz him with the app closed)

Run `supabase/003_push.sql` in the SQL Editor, then add to `.env.local`:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT=mailto:you@…`.

You also need **`SUPABASE_SERVICE_ROLE_KEY`** (Settings → API). This one is
server-only — it must NOT be prefixed `NEXT_PUBLIC_`. The send route uses it to
read the *other* person's push subscription, which row-level security rightly
forbids everyone else from doing.

> Android honours the custom vibration pattern. iPhone needs iOS 16.4+ **and the
> app installed to the home screen**, and buzzes with the system default rather
> than our rhythm.

### 4. Gemini (the AI)
Free key: **https://aistudio.google.com/apikey**

### 5. Fill in your keys
```bash
cp .env.example .env.local
```
Then edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-flash-latest
```

### 6. Start it
```bash
npm run dev
```

Open **http://localhost:3000**.

### 7. Test with two phones
Find your laptop's IP:
```bash
ipconfig getifaddr en0
```
Both phones on the same wifi → `http://<that-ip>:3000`

- **Her phone:** sign in → *"I'm the one in pain"* → note the Cuddle Code
- **His phone:** sign in → *"I'm here to help"* → type the code
- She writes how she feels → **his phone buzzes**

### iPhone vs Android

| | Android (Chrome) | iPhone (Safari) |
|---|---|---|
| Install as an app | ✅ install button | ✅ Share → Add to Home Screen |
| Everything else | ✅ | ✅ |
| **Real vibration** | ✅ | ❌ Safari has never shipped the Vibration API |
| Instead, iPhone gets | — | full-screen **pulse** on the same rhythm, plus an optional low **tone** through the speaker (🔇 toggle, top right) |

**Demo on Android.** The pulse is a good fallback, not a replacement — the whole
point of Yuzu is something you feel without looking at the screen.

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Then in the Vercel dashboard → **Settings → Environment Variables**, add all three
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY`),
and redeploy:

```bash
vercel --prod
```

**Don't forget:** add `https://YOUR-APP.vercel.app/auth/callback` to Supabase's
redirect URLs, and to your Google OAuth client's authorised redirect URIs.
This is the single most common reason login breaks in production.

Vercel gives you HTTPS, which the PWA install and the vibration API both require.

---

## The QR moment — `/demo`

`https://YOUR-APP.vercel.app/demo` — **no login, no pairing.** Put the QR code on
your slide. The whole room scans it, taps once, and every phone buzzes with the
same cramp, then reads what she actually wrote.

Safe at scale because every phone sends the *same* message, so after the first one
it is all cache: **forty phones, one Gemini call.**

The tap is required, not decorative — browsers refuse to vibrate until the user
has touched the page.

---

## It's a PWA

On the deployed site, phones offer **"Add to home screen"** and it opens
full-screen with no browser chrome — it looks and feels like a real app.

- `public/manifest.webmanifest` — name, colours, icons
- `public/sw.js` — caches the shell so it opens instantly; live data always
  hits the network
- `components/InstallPrompt.tsx` — the install button (Android) and the
  Share → Add to Home Screen hint (iOS)

Icons are generated pink hearts in `public/`. Swap them for your own art if you like.

---

## What the AI does

One call. Her sentence in, three things out:

| Output | Why it needs AI |
|---|---|
| **A buzz pattern** | "Stabbing" and "dull ache" must *feel* different. Fixed buttons can't. |
| **Every need she mentioned** | "Freezing, back hurts, miss you" is **three** needs. Score hits 0 only when all three are ticked. |
| **Hints per need** | He's nudged toward whatever is *still unfixed*, never told. Clearer each failed try. |

Prompt: `lib/translate.ts`. Route: `app/api/translate/route.ts`.

**Three providers, tried in order, and the last one cannot fail:**

1. **BullsAI** — `ALT_AI_BASE_URL`, `ALT_AI_API_KEY`, `ALT_AI_MODEL`
2. **Gemini** — `GEMINI_API_KEY`, `GEMINI_MODEL` (itself a comma-separated chain)
3. **Built-in rules** — no keys, no network, always works

Any provider left unconfigured is skipped. Gemini returned 503 "high demand"
several times during one afternoon of testing, which is exactly why this is a
chain and not a single call.

The browser never talks to any of them — the keys stay server-side, and her
message never reaches the phone of the person guessing.

---

## The rules we don't break

- **He cannot stop his own phone.** Only she can.
- **He never sees her words** until he's failed 5 times.
- **She always finds out** how he did — win or lose, including when he walks away.
- **He can leave.** A hidden page cannot vibrate; that is the browser, not a bug.
  So he is never trapped — his leaving just shows up on her screen.
- **Nothing extra on either screen.**
- The buzz loop is capped at 10 minutes. Deliberate — say so in the pitch.

See `PLAN.md` for the schedule and the demo/video plan.
