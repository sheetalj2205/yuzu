import type { Item } from "./types";

/** His drawer. He picks from these based on the AI's hint. */
export const ITEMS: Item[] = [
  { id: "hug",     emoji: "🫂",  name: "A long hug",        tag: "company" },
  { id: "kiss",    emoji: "😘",  name: "Kiss goodnight",    tag: "company" },
  { id: "heat",    emoji: "♨️",  name: "Hot water bottle",  tag: "heat"    },
  { id: "tea",     emoji: "🍵",  name: "Make her tea",      tag: "heat"    },
  { id: "blanket", emoji: "🧣",  name: "Send a blanket",    tag: "warmth"  },
  { id: "meds",    emoji: "💊",  name: "Painkiller run",    tag: "meds", once: true },
  { id: "music",   emoji: "🎧",  name: "Her playlist",      tag: "company" },
  { id: "cat",     emoji: "🐈",  name: "Call in the cat",   tag: "company" },
  { id: "cancel",  emoji: "📵",  name: "Cancel her 9am",    tag: "rest", once: true },
  { id: "yoga",    emoji: "🧘",  name: "“Tried yoga?”", tag: "bad", bad: true },
];

/** Emoji he can pick when adding one of her favourites. */
export const FAVE_EMOJI = ["🍫","🧸","🍜","🌹","🍦","📖","🎬","🧁","🍿","🌻","💐","🛁"];

/** Cuddle Code, 6 friendly characters, no confusing 0/O/1/I. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function makeCuddleCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}
