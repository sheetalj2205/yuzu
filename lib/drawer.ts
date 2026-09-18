import type { Item } from "./types";

/**
 * HIS DRAWER, ARRANGED HIS WAY.
 *
 * Which things he keeps and what order they sit in is a preference about his
 * own screen, not shared state, so it lives on his phone rather than in the
 * room. She never sees his layout, and he does not need a round trip to move a
 * tile. Keyed by room so two different partners do not share one arrangement.
 *
 * Every read and write is wrapped: a private window, cleared site data or a
 * locked-down browser all make localStorage throw, and a drawer that will not
 * remember its order is still a perfectly good drawer.
 */
export type DrawerPrefs = { order: string[]; hidden: string[] };

const EMPTY: DrawerPrefs = { order: [], hidden: [] };
const key = (room: string) => `yuzu:drawer:${room}`;

export function loadPrefs(room: string): DrawerPrefs {
  try {
    const raw = localStorage.getItem(key(room));
    if (!raw) return EMPTY;
    const p = JSON.parse(raw) as Partial<DrawerPrefs>;
    return {
      order:  Array.isArray(p.order)  ? p.order.map(String)  : [],
      hidden: Array.isArray(p.hidden) ? p.hidden.map(String) : [],
    };
  } catch {
    return EMPTY;
  }
}

export function savePrefs(room: string, prefs: DrawerPrefs): void {
  try {
    localStorage.setItem(key(room), JSON.stringify(prefs));
  } catch {
    /* he just loses the arrangement next time, nothing else breaks */
  }
}

/**
 * The drawer as he should see it: his order first, anything he has never
 * arranged (a favourite added a minute ago) on the end, and the ones he threw
 * out left off entirely.
 */
export function arrange(all: Item[], prefs: DrawerPrefs): Item[] {
  const byId = new Map(all.map(i => [i.id, i]));
  const out: Item[] = [];
  const placed = new Set<string>();

  for (const id of prefs.order) {
    const item = byId.get(id);
    if (item && !placed.has(id)) { out.push(item); placed.add(id); }
  }
  for (const item of all) if (!placed.has(item.id)) out.push(item);

  const gone = new Set(prefs.hidden);
  return out.filter(i => !gone.has(i.id));
}

/** Move one tile to another tile's slot, keeping everything else in line. */
export function moveTo(ids: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
  const next = [...ids];
  const [picked] = next.splice(from, 1);
  next.splice(to, 0, picked);
  return next;
}
