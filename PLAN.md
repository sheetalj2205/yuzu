# Yuzu, build plan

> **Pain travels one way. Comfort travels back.**
> She sends her cramp to his phone. He can't switch it off. He has 5 tries to work out
> what she needs, and only she can say when it stops.

Room codes are called **Cuddle Codes**. 🍊

---

## 1. What we are building

Two phones, one website. Installable to the home screen as a PWA, no app store.

| | Her phone | His phone |
|---|---|---|
| Sees | A sad anime girl in her room, a box to write in, an intensity slider | A hint from the AI, a drawer of things to send, tries left |
| Never sees | - | **Her actual message** (until he fails 5 times) |
| Can do | Write how she feels · send it · say "that helped" / "not really" | Send things from the drawer · add her favourites |
| Phone does | Soft, slow buzz when something arrives | Hard, sharp buzz - **on a loop, until she says stop** |

### The one rule that makes it a game
> **He cannot stop his own phone. Only she can.**
> And she only stops it when *every* thing she asked for has been fixed.

---

## 2. The flow, screen by screen

```
  /                  Sign in with Google
  ↓
  /onboarding        "Are you the one in pain, or the one helping?"
  ↓
  /room              she → gets a Cuddle Code      he → types the Cuddle Code
  ↓
  /room/[code]       "Kabir joined to feel your pain and make it better ♡"
                     "You're in. Now feel her pain and calm her down ♡"
  ↓
  THE LOOP           she writes + intensity → AI splits it into needs
                     → his phone buzzes on a loop
                     → he guesses from a hint
                     → she judges each gift
                     → all needs ticked = score 0, buzzing stops, new cycle
                     → 5 failed tries = her real message is shown to him,
                       she is told he failed, and she gets to hit back
                       (each punch fires his phone)
```

---

## 3. What the AI actually does

One job, three outputs, from one call. Her sentence goes in, this comes out:

```json
{
  "envelope": "grind",
  "peak": 0.9,
  "pulse_ms": 2200,
  "duration_s": 110,
  "label": "Leaden cold ache",
  "needs": [
    { "tag": "heat",    "label": "something warm",
      "hints": ["Something is cold.", "She wants heat, not a drink.",
                "Heat held against her, low down."] },
    { "tag": "meds",    "label": "the back pain",
      "hints": ["Warmth won't reach this one.", "Something has to actually dull it.",
                "She needs the pain blocked, not soothed."] },
    { "tag": "company", "label": "him, nearby",
      "hints": ["She's on her own.", "Being alone is part of it.",
                "She wants your voice, not a parcel."] }
  ]
}
```

1. **Words → a buzz pattern.** A normal app needs fixed buttons. AI reads any sentence,
   in any words, and turns it into numbers the phone can vibrate with.
2. **Words → a list of needs.** "I'm freezing, my back is killing me and I miss you"
   is **three** separate needs, not one. The score only reaches 0 when all three are ticked.
3. **Hints per need, never the words.** Each need carries its own hints, so he is always
   nudged toward something *still unfixed* - once she ticks "something warm" off, he stops
   being told she is cold. Clearer each failed try. He never sees her sentence until try 5.

**Model:** Gemini Flash, called from our own server route so the browser never sees the key
and **her message never reaches the phone of the person guessing** - that separation is the
product, not an implementation detail.

**Fallback:** a rule-based translator in the same file. If Gemini is down, rate-limited or the
key is missing, it takes over automatically and nobody notices. Ship both.

---

## 4. Tech

| Layer | Choice | Why |
|---|---|---|
| App | **Next.js 15 (App Router) + TypeScript** | One codebase for both phones |
| Styling | **Tailwind** | Fast, and the whole palette lives in one config |
| Auth | **Supabase Auth → Google** | Google login in ~20 minutes, no password handling |
| DB + live sync | **Supabase Postgres + Realtime** | Her phone → his phone in under a second |
| AI | **Gemini Flash**, behind `/api/translate` | Free tier, cloud-hosted, works for anyone with the link |
| Buzz | `navigator.vibrate()` | Works in Chrome on **Android**. iPhone can't, plan around it |
| Deploy | **Vercel** (HTTPS, needed for PWA install + vibration) | One command, free |
| Install | **PWA** - add to home screen | Feels like a real app, no app store |

⚠️ **Android for the demo.** iOS Safari has no Vibration API. Both phones on Android, or
one Android + one laptop with a game controller.

---

## 5. Data model

```sql
profiles   id · email · name · avatar_url · gender('her'|'him')
rooms      id · code(6 chars) · her_id · him_id · created_at
cycles     id · room_id · message · intensity · pattern(jsonb) ·
           needs(jsonb) · tries · revealed · closed_at
gifts      id · cycle_id · emoji · name · tag · verdict('pending'|'helped'|'no')
```

`needs` is the scoreboard *and* the hint source: `[{tag, label, hints:[3], done}]`.
`score = round(intensity * 10 * unmet / total)` → hits **0** only when every `done` is true.

---

## 6. Two-day schedule

### Day 1, it works
| Hours | Task | Done when |
|---|---|---|
| 0–2 | Next.js + Tailwind + Supabase project, Google login | You can sign in |
| 2–3 | `/onboarding` gender, `profiles` row | Refresh keeps your role |
| 3–5 | Cuddle Code: she creates, he joins, both see each other's name | Two phones, one room |
| 5–7 | She writes + intensity → row in `cycles` → **his phone buzzes** | The real moment |
| 7–9 | `/api/translate` with Gemini + fallback | Different words = different buzz |
| 9–11 | Drawer, send a gift, her verdict buttons | A full round plays |

**End of Day 1 you have a demo.** Everything below makes it win.

### Day 2, it wins
| Hours | Task | Why it matters |
|---|---|---|
| 0–2 | Multi-need scoring + the buzz loop | The heart of the game |
| 2–3 | 5-try reveal, telling her he failed, her revenge round | Your best slide |
| 3–4 | Add-her-favourite items | Judges love the personal touch |
| 4–6 | The anime room: gifts collecting around her, warming up | Your best shot |
| 6–8 | Polish, empty states, mobile check | Presentation = 25% |
| 8–12 | **Film the video. Rehearse 5 times.** | Presentation = 25% |

---

## 7. Hitting the four criteria

| Criterion | 25% | How we win it |
|---|---|---|
| **Innovation** | Two-way haptics between two people on different continents. Cramp simulators exist; *comfort* travelling back does not. AI translating words → felt sensation is the novel bit. |
| **Impact** | Long distance is huge: students, migrant workers, couples apart. And the real point underneath, women describe pain and aren't believed. Yuzu makes it undeniable. |
| **Feasibility** | A website anyone installs to their home screen. No app store, no hardware. Gemini's free tier covers it. Day 1 already demos. |
| **Presentation** | QR on the slide → **the whole room's phones buzz at once**. Then rice on a phone for the video. Nobody forgets it. |

---

## 8. Filming it (vibration is invisible!)

1. **Rice on the phone.** Sprinkle a few grains. It jumps when it buzzes. Best shot you have.
2. **Hard table, mic on.** A sharp jab and a slow rumble *sound* different. Never film on a sofa.
3. **One unbroken take** with both phones in frame, proof it's real, not edited.
4. **End on a QR code.** A judge who feels it while watching has already scored you.

---

## 9. Hard rules for every screen

- **No clutter.** Her screen: the girl, a box, a slider, one button. That's it.
- **She is always in control.** She logs it, she judges it, she ends it. The app never
  tells her what to do, it only asks "did that help?"
- **He never sees her words** until he has failed 5 times.
- **Cap the buzz loop** at ~10 minutes with a pause on her side. Uncapped is a rage-quit.
  Say this on stage as a design decision, not an oversight.
- **He can leave. He just can't do it quietly.** Browsers refuse to vibrate, play
  sound or run timers while a page is hidden, so there is no way to buzz a phone
  whose app is closed without Web Push. Rather than pretend, Yuzu shows her:
  *"Kabir closed the app. You still can't."* Same rule as everything else, she
  always finds out. Web Push (a real background buzz) is the roadmap slide.
