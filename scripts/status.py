#!/usr/bin/env python3
"""Who is signed up, who is paired with whom, and what is going on right now."""
import json, os, urllib.request, urllib.error

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
        with urllib.request.urlopen(urllib.request.Request(url + "/rest/v1/" + path, headers=H), timeout=15) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"__error": f"{e.code} {e.read().decode()[:80]}"}

profiles = get("profiles?select=id,name,email,gender")
if isinstance(profiles, dict):
    raise SystemExit("could not read profiles: " + profiles.get("__error", "?"))
by_id = {p["id"]: p for p in profiles}

print(f"── people ({len(profiles)}) ──")
for p in profiles:
    who = {"her": "🌸 her", "him": "🧢 him"}.get(p.get("gender"), "❓ no role")
    print(f"   {who}  {p.get('name') or '?':22} {p.get('email') or ''}")

rooms = get("rooms?select=id,code,her_id,him_id,created_at&order=created_at.desc")
print(f"\n── rooms ({len(rooms)}) ──")
for r in rooms:
    her = by_id.get(r["her_id"], {}).get("name", "—") if r.get("her_id") else "—"
    him = by_id.get(r["him_id"], {}).get("name", "(nobody yet)") if r.get("him_id") else "(nobody yet)"
    print(f"   {r['code']}   🌸 {her}  ↔  🧢 {him}")

cycles = get("cycles?select=id,message,intensity,tries,revealed,closed_at,needs&order=created_at.desc&limit=5")
print(f"\n── recent cycles ({len(cycles)}) ──")
for c in cycles:
    needs = c.get("needs") or []
    done = sum(1 for n in needs if n.get("done"))
    state = "closed ✅" if c.get("closed_at") else ("revealed 🔓" if c.get("revealed") else "open")
    print(f"   \"{(c.get('message') or '')[:42]}\"")
    print(f"      intensity {c.get('intensity')}  ·  tries {c.get('tries')}  ·  {done}/{len(needs)} needs met  ·  {state}")

subs = get("push_subscriptions?select=user_id")
if isinstance(subs, list):
    print(f"\n── push ──")
    if not subs: print("   nobody has enabled notifications yet")
    for s in subs:
        print(f"   🔔 {by_id.get(s['user_id'], {}).get('name', s['user_id'][:8])}")
