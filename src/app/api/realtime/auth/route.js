import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { getPusherServer } from "@/server/pusher.js";
import { ONLINE_PRESENCE_CHANNEL, USER_CHANNEL_PREFIX, getUserChannelName } from "@/lib/realtime.js";

async function parseChannelAuthPayload(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return request.json();
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const form = await request.formData();
    return {
      socket_id: String(form.get("socket_id") || ""),
      channel_name: String(form.get("channel_name") || ""),
    };
  }

  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);
  return {
    socket_id: String(params.get("socket_id") || ""),
    channel_name: String(params.get("channel_name") || ""),
  };
}

export async function POST(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { socket_id: socketId, channel_name: channelName } = await parseChannelAuthPayload(request);

    if (!socketId || !channelName) {
      return NextResponse.json({ message: "Invalid realtime auth payload" }, { status: 400 });
    }

    const isPresenceChannel = channelName === ONLINE_PRESENCE_CHANNEL;
    const isPrivateUserChannel = channelName.startsWith(USER_CHANNEL_PREFIX);

    if (!isPresenceChannel && !isPrivateUserChannel) {
      return NextResponse.json({ message: "Unauthorized channel" }, { status: 403 });
    }

    if (isPrivateUserChannel && channelName !== getUserChannelName(user._id)) {
      return NextResponse.json({ message: "Unauthorized user channel" }, { status: 403 });
    }

    const pusherServer = getPusherServer();
    if (!pusherServer) {
      return NextResponse.json({ message: "Realtime provider not configured" }, { status: 500 });
    }

    let authPayload;
    if (isPresenceChannel) {
      authPayload = pusherServer.authorizeChannel(socketId, channelName, {
        user_id: String(user._id),
        user_info: {
          fullName: user.fullName,
          profilePic: user.profilePic,
        },
      });
    } else {
      authPayload = pusherServer.authorizeChannel(socketId, channelName);
    }

    return NextResponse.json(authPayload, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
