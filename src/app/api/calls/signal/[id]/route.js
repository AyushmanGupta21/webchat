import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { getPusherServer } from "@/server/pusher.js";
import {
  CALL_SIGNAL_EVENT,
  CALL_SIGNAL_TYPES,
  getUserChannelName,
} from "@/lib/realtime.js";

const ALLOWED_SIGNAL_TYPES = new Set(Object.values(CALL_SIGNAL_TYPES));

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const pusherServer = getPusherServer();
    if (!pusherServer) {
      return NextResponse.json({ message: "Realtime provider is not configured" }, { status: 500 });
    }

    const { id: receiverId } = await params;
    if (!receiverId) {
      return NextResponse.json({ message: "Receiver id is required" }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const signalType = String(payload?.type || "");

    if (!ALLOWED_SIGNAL_TYPES.has(signalType)) {
      return NextResponse.json({ message: "Invalid call signal type" }, { status: 400 });
    }

    const sessionId = String(payload?.sessionId || "");
    if (!sessionId) {
      return NextResponse.json({ message: "Call session id is required" }, { status: 400 });
    }

    const signalEventPayload = {
      type: signalType,
      sessionId,
      callType: payload?.callType || null,
      sdp: payload?.sdp || null,
      candidate: payload?.candidate || null,
      fromUser: {
        _id: user._id,
        fullName: user.fullName,
        profilePic: user.profilePic,
      },
      sentAt: Date.now(),
    };

    await pusherServer.trigger(
      getUserChannelName(receiverId),
      CALL_SIGNAL_EVENT,
      signalEventPayload
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to send call signal" }, { status: 500 });
  }
}