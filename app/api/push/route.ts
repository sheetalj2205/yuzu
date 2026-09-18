import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";   // web-push needs node crypto

/**
 * Send a buzz to the other person in a room, even with the app closed.
 *
 * Reading someone else's push subscription is deliberately impossible under RLS,
 * so this route uses the service role, and therefore checks for itself that the
 * caller really is in the room they are trying to buzz.
 */
export async function POST(req: Request) {
  const { roomId, title, body, vibrate, tag, url } = await req.json();
  if (!roomId) return NextResponse.json({ error: "roomId required" }, { status: 400 });

  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!service || !publicKey || !privateKey) {
    return NextResponse.json({ sent: 0, reason: "push not configured" });
  }

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, service, {
    auth: { persistSession: false },
  });

  const { data: room } = await admin
    .from("rooms").select("her_id, him_id").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "no such room" }, { status: 404 });

  let target: string | null = null;
  if (room.her_id === user.id) target = room.him_id;
  else if (room.him_id === user.id) target = room.her_id;
  else return NextResponse.json({ error: "not your room" }, { status: 403 });

  if (!target) return NextResponse.json({ sent: 0, reason: "nobody to send to" });

  const { data: subs } = await admin
    .from("push_subscriptions").select("*").eq("user_id", target);
  if (!subs?.length) return NextResponse.json({ sent: 0, reason: "they have not enabled push" });

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@example.com", publicKey, privateKey);

  const payload = JSON.stringify({
    title: title ?? "She needs you",
    body: body ?? "Open Yuzu.",
    vibrate: vibrate ?? [300, 120, 300, 120, 300],
    tag: tag ?? "yuzu-cramp",
    // tapping it lands him in the room, already buzzing, not on a menu
    url: typeof url === "string" && url.startsWith("/") ? url : "/room",
  });

  /**
   * How it is sent matters as much as what is sent, on an iPhone.
   *
   * urgency "high": the default is "normal", and a push service is allowed to
   * sit on those and deliver them in a batch later to save the phone's battery.
   * A cramp delivered in its own good time is not a cramp. High tells Apple to
   * wake the phone now, which is also what makes it alert rather than arrive
   * quietly in Notification Center.
   *
   * TTL 10 minutes: the default is FOUR WEEKS. With his phone off, Apple would
   * hold every one of these and deliver the lot days later, so he would be
   * buzzed thirty times for a cramp she had long since got over. Ten minutes
   * matches the cap on the buzz loop: past that, it is not news any more.
   */
  const howToSend = { urgency: "high" as const, TTL: 600 };

  let sent = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, howToSend);
      sent++;
    } catch (err) {
      // 404/410 mean the browser threw the subscription away, stop storing it
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) dead.push(s.endpoint);
    }
  }));

  if (dead.length) await admin.from("push_subscriptions").delete().in("endpoint", dead);
  // `failed` is the number Apple or Google rejected without saying the
  // subscription is gone, which is a different problem from having none
  return NextResponse.json({ sent, pruned: dead.length, had: subs.length,
                             failed: subs.length - sent - dead.length });
}
