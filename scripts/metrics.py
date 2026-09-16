#!/usr/bin/env python3
"""Numbers you can put on a slide. Reads what the app already stores — no tracking added."""
import json, os, urllib.request, urllib.error
from collections import Counter
from datetime import datetime

root = os.path.join(os.path.dirname(__file__), "..")
env = {}
for line in open(os.path.join(root, ".env.local")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); env[k.strip()] = v.strip()

url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
key = env.get("SUPABASE_SERVICE_ROLE_KEY") or env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
H = {"apikey": key, "Authorization": f"Bearer {key}"}

def get(path):
    try:
        with urllib.request.urlopen(urllib.request.Request(url + "/rest/v1/" + path, headers=H), timeout=20) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return []

def day(ts):
    try: return datetime.fromisoformat(ts.replace("Z", "+00:00")).strftime("%d %b")
    except Exception: return "?"

profiles = get("profiles?select=id,gender,created_at")
rooms    = get("rooms?select=id,her_id,him_id,created_at")
cycles   = get("cycles?select=id,intensity,tries,revealed,closed_at,needs,created_at")
gifts    = get("gifts?select=id,tag,name")
subs     = get("push_subscriptions?select=user_id")

bar = lambda n, of: "█" * min(28, round(28 * n / of)) if of else ""

print("\n╭─ YUZU ─────────────────────────────────────")
print(f"│  people signed up      {len(profiles)}")
roles = Counter(p.get("gender") for p in profiles)
print(f"│     🌸 in pain          {roles.get('her', 0)}")
print(f"│     🧢 helping          {roles.get('him', 0)}")

paired = [r for r in rooms if r.get("her_id") and r.get("him_id")]
print(f"│")
print(f"│  rooms created         {len(rooms)}")
print(f"│     actually paired    {len(paired)}"
      + (f"   ({round(100*len(paired)/len(rooms))}%)" if rooms else ""))

closed = [c for c in cycles if c.get("closed_at")]
failed = [c for c in cycles if c.get("revealed") and not c.get("closed_at")]
print(f"│")
print(f"│  cramps sent           {len(cycles)}")
print(f"│     he got there       {len(closed)}")
print(f"│     he ran out         {len(failed)}")
if cycles:
    avg_i = sum(c.get("intensity") or 0 for c in cycles) / len(cycles)
    print(f"│     avg intensity      {avg_i:.1f} / 10")
if closed:
    avg_t = sum(c.get("tries") or 0 for c in closed) / len(closed)
    print(f"│     avg tries to win   {avg_t:.1f}")

multi = [c for c in cycles if len(c.get("needs") or []) > 1]
if cycles:
    print(f"│     several needs      {len(multi)} of {len(cycles)}"
          f"   ({round(100*len(multi)/len(cycles))}%)")

real = [g for g in gifts if g.get("tag") not in ("strike",)]
strikes = [g for g in gifts if g.get("tag") == "strike"]
print(f"│")
print(f"│  things he sent        {len(real)}")
print(f"│  times she hit back    {len(strikes)}")
print(f"│  push enabled          {len(subs)}")

if profiles:
    print("│")
    print("│  sign-ups by day")
    per = Counter(day(p.get("created_at") or "") for p in profiles)
    top = max(per.values())
    for d, n in list(per.items())[-7:]:
        print(f"│     {d:8} {bar(n, top)} {n}")

if real:
    print("│")
    print("│  most sent")
    for name, n in Counter(g.get("name") for g in real).most_common(5):
        print(f"│     {str(name)[:22]:24} {n}")

print("╰────────────────────────────────────────────\n")
