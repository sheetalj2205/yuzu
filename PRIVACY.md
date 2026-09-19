# What Yuzu stores, and who can read it

Yuzu is a hackathon project, not a commercial service. It is still worth being
plain about the data, because some of it is personal and some of it is about
health.

## What is stored

| What | Why | Where |
|---|---|---|
| Your name, email and profile picture | So your partner sees who joined | Supabase, from your Google account |
| Whether you are the one in pain or the one helping | To decide which screen to show | Supabase |
| Room codes, and who is in each room | To pair two people | Supabase |
| **What she writes about her pain**, and how bad she says it is | It is the input the game runs on | Supabase |
| Gifts sent, and whether she said they helped | To score the round | Supabase |
| A notification address for your phone | To reach you when the app is closed | Supabase |

## Who can read it

- **Only the two people in a room.** This is enforced by the database itself
  (Postgres row-level security), not only by the app. Someone who knows a room
  code still cannot read that room.
- **Her message is not sent to his phone** while he is guessing. It only reaches
  him after his third wrong guess, which is the point of the game.
- **The AI sees her message on our server, never in a browser.** It goes to
  Google's Gemini API to produce the clues. Do not type anything into Yuzu that
  you would not want processed by that API.
- **Nobody else.** There is no analytics, no tracking, no advertising, and
  nothing is shared with any third party beyond the services listed below.

## Services used

Supabase (sign-in, database, live sync), Google Gemini (the clues), Vercel
(hosting), Google Sign-In (identity), Apple and Google push services (delivering
notifications to phones).

## Deleting your data

Closing a room deletes that room and everything in it: its messages, its gifts
and its favourites. For anything else, or to remove an account entirely, email
the address on the GitHub profile that owns this repository.

## If you are judging this project

Please use a test Google account, and treat anything you type as demo data.
