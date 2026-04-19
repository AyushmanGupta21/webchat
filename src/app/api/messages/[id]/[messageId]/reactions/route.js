import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { getPusherServer } from "@/server/pusher.js";
import { areUsersFriends } from "@/server/friends.js";
import { MESSAGE_EVENTS, getUserChannelName } from "@/lib/realtime.js";

const MAX_EMOJI_LENGTH = 16;

async function getConversationMessage(messageId, userId, peerUserId) {
  const result = await dbQuery(
    `
      SELECT
        id,
        sender_id AS "senderId",
        receiver_id AS "receiverId",
        deleted_by_sender AS "deletedBySender",
        deleted_by_receiver AS "deletedByReceiver"
      FROM messages
      WHERE id = $1
        AND (
          (sender_id = $2 AND receiver_id = $3)
          OR (sender_id = $3 AND receiver_id = $2)
        )
      LIMIT 1
    `,
    [messageId, userId, peerUserId]
  );

  return result.rows[0] || null;
}

async function getMessageReactions(messageId) {
  const result = await dbQuery(
    `
      SELECT
        emoji,
        user_id AS "userId"
      FROM message_reactions
      WHERE message_id = $1
      ORDER BY created_at ASC
    `,
    [messageId]
  );

  return result.rows;
}

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { id: peerUserId, messageId } = await params;
    const parsedMessageId = Number.parseInt(String(messageId), 10);
    if (!Number.isFinite(parsedMessageId)) {
      return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
    }

    const isFriend = await areUsersFriends(user._id, peerUserId);
    if (!isFriend) {
      return NextResponse.json({ error: "You can chat only with friends" }, { status: 403 });
    }

    const payload = await request.json().catch(() => ({}));
    const emoji = String(payload?.emoji || "").trim();
    if (!emoji || emoji.length > MAX_EMOJI_LENGTH) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    const existingMessage = await getConversationMessage(parsedMessageId, user._id, peerUserId);
    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const isDeletedForActor =
      (existingMessage.senderId === user._id && existingMessage.deletedBySender) ||
      (existingMessage.receiverId === user._id && existingMessage.deletedByReceiver);

    if (isDeletedForActor) {
      return NextResponse.json({ error: "Message is no longer available" }, { status: 410 });
    }

    const existingReactionResult = await dbQuery(
      `
        SELECT emoji
        FROM message_reactions
        WHERE message_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [parsedMessageId, user._id]
    );

    const existingReaction = existingReactionResult.rows[0]?.emoji;

    if (existingReaction === emoji) {
      await dbQuery(
        `
          DELETE FROM message_reactions
          WHERE message_id = $1 AND user_id = $2
        `,
        [parsedMessageId, user._id]
      );
    } else {
      await dbQuery(
        `
          INSERT INTO message_reactions (message_id, user_id, emoji)
          VALUES ($1, $2, $3)
          ON CONFLICT (message_id, user_id)
          DO UPDATE SET emoji = EXCLUDED.emoji, created_at = NOW()
        `,
        [parsedMessageId, user._id, emoji]
      );
    }

    const reactions = await getMessageReactions(parsedMessageId);

    const pusherServer = getPusherServer();
    if (pusherServer) {
      try {
        await pusherServer.trigger(getUserChannelName(peerUserId), MESSAGE_EVENTS.REACTION, {
          messageId: String(parsedMessageId),
          reactions,
          peerUserId: user._id,
          actedBy: user._id,
        });
      } catch {
        // Reaction should still succeed without realtime.
      }
    }

    return NextResponse.json(
      {
        messageId: String(parsedMessageId),
        reactions,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
