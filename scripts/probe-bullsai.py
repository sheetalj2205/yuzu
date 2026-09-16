#!/usr/bin/env python3
"""Check whether BullsAI speaks the shape Yuzu expects. Never prints the key."""
import json, os, sys, time, urllib.request, urllib.error

env = {}
for line in open(os.path.join(os.path.dirname(__file__), "..", ".env.local")):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, _, v = line.partition("="); env[k.strip()] = v.strip()

base  = env.get("ALT_AI_BASE_URL", "")
key   = env.get("ALT_AI_API_KEY", "")
model = env.get("ALT_AI_MODEL", "")

print(f"base  : {base or '❌ not set'}")
print(f"model : {model or '❌ not set'}")
print(f"key   : {'✅ set (' + str(len(key)) + ' chars)' if key else '❌ not set'}\n")
if not (base and key and model):
    sys.exit("fill in ALT_AI_* in .env.local first")

def call(payload, label):
    url = base.rstrip("/") + "/chat/completions"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
            txt = d.get("choices", [{}])[0].get("message", {}).get("content")
            if txt is None:
                print(f"{label}: ⚠️  200 but no choices[0].message.content")
                print("   keys returned:", list(d.keys())); return None
            print(f"{label}: ✅ {time.time()-t0:.1f}s")
            return txt
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"{label}: ❌ HTTP {e.code} — {body}")
    except Exception as e:
        print(f"{label}: ❌ {type(e).__name__}: {e}")
    return None

# 1. does it work at all, in the OpenAI shape?
call({"model": model, "messages": [{"role": "user", "content": "Say hi in three words."}]},
     "plain chat     ")

# 2. does it honour response_format? that is what Yuzu relies on
txt = call({"model": model, "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": 'Reply with only {"ok": true}'}]},
           "json mode      ")
if txt:
    try:
        json.loads(txt); print("                  and the reply parsed as JSON ✅")
    except Exception:
        print(f"                  ⚠️  reply was NOT clean JSON: {txt[:120]!r}")

# 3. the real Yuzu prompt
src = open(os.path.join(os.path.dirname(__file__), "..", "lib", "translate.ts")).read()
s = src.index("return `") + len("return `"); e = src.index("`;", s)
prompt = (src[s:e].replace("${message}", "I'm freezing, my back is killing me and I miss you")
                  .replace("${intensity}", "9"))
txt = call({"model": model, "temperature": 0.4,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "user", "content": prompt}]},
           "the real prompt")
if txt:
    try:
        d = json.loads(txt)
        needs = d.get("needs", [])
        print(f"\n  label : {d.get('label')}")
        print(f"  needs : {len(needs)}")
        for n in needs:
            print(f"    · {n.get('tag'):8} {n.get('label')}   ({len(n.get('hints', []))} hints)")
            for h in n.get("hints", [])[:2]:
                print(f"         {h}")
        print("\n✅ BullsAI works with Yuzu as-is." if needs else "\n⚠️  no needs returned")
    except Exception as ex:
        print(f"\n⚠️  could not parse: {ex}\n{txt[:300]}")
