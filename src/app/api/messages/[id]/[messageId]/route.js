import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { getPusherServer } from "@/server/pusher.js";
import { areUsersFriends } from "@/server/friends.js";
import { MESSAGE_EVENTS, getUserChannelName } from "@/lib/realtime.js";

async function getMessageForConversation(messageId, userId, peerUserId) {
  const result = await dbQuery(
    `
      SELECT
        id,
        sender_id AS "senderId",
        receiver_id AS "receiverId",
        text,
        image_url AS image,
        image_encrypted AS "imageEncrypted",
        image_iv AS "imageIv",
        image_mime_type AS "imageMimeType",
        image_file_name AS "imageFileName",
        reply_to_message_id AS "replyToMessageId",
        edited_at AS "editedAt",
        deleted_by_sender AS "deletedBySender",
        deleted_by_receiver AS "deletedByReceiver",
        created_at AS "createdAt"
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

async function getMessagePayload(messageId) {
  const payload = await dbQuery(
    `
      SELECT
        m.id::text AS "_id",
        m.sender_id AS "senderId",
        m.receiver_id AS "receiverId",
        m.text,
        m.image_url AS image,
        m.image_encrypted AS "imageEncrypted",
        m.image_iv AS "imageIv",
        m.image_mime_type AS "imageMimeType",
        m.image_file_name AS "imageFileName",
        m.reply_to_message_id::text AS "replyToMessageId",
        m.edited_at AS "editedAt",
        m.created_at AS "createdAt",
        CASE
          WHEN r.id IS NULL THEN NULL
          ELSE json_build_object(
            '_id', r.id::text,
            'senderId', r.sender_id,
            'text', r.text,
            'image', r.image_url
          )
        END AS "replyToMessage",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'emoji', mr.emoji,
                'userId', mr.user_id
              )
              ORDER BY mr.created_at ASC
            )
            FROM message_reactions mr
            WHERE mr.message_id = m.id
          ),
          '[]'::json
        ) AS reactions
      FROM messages m
      LEFT JOIN messages r ON r.id = m.reply_to_message_id
      WHERE m.id = $1
      LIMIT 1
    `,
    [messageId]
  );

  return payload.rows[0] || null;
}

export async function PATCH(request, { params }) {
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

    const body = await request.json().catch(() => ({}));
    const nextText = typeof body?.text === "string" ? body.text.trim() : "";
    if (!nextText) {
      return NextResponse.json({ error: "Message text is required" }, { status: 400 });
    }

    const existingMessage = await getMessageForConversation(parsedMessageId, user._id, peerUserId);
    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (existingMessage.senderId !== user._id) {
      return NextResponse.json({ error: "You can only edit your own messages" }, { status: 403 });
    }

    await dbQuery(
      `
        UPDATE messages
        SET text = $2,
            edited_at = NOW()
        WHERE id = $1
      `,
      [parsedMessageId, nextText]
    );

    const updatedMessage = await getMessagePayload(parsedMessageId);

    const pusherServer = getPusherServer();
    if (pusherServer && updatedMessage) {
      try {
        await pusherServer.trigger(getUserChannelName(peerUserId), MESSAGE_EVENTS.UPDATED, {
          message: updatedMessage,
          peerUserId: user._id,
          updatedBy: user._id,
        });
      } catch {
        // Message edit should still succeed without realtime.
      }
    }

    return NextResponse.json(updatedMessage, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

    const url = new URL(request.url);
    const requestBody = await request.json().catch(() => ({}));
    const scope =
      String(url.searchParams.get("scope") || requestBody?.scope || "me").toLowerCase() === "everyone"
        ? "everyone"
        : "me";

    const existingMessage = await getMessageForConversation(parsedMessageId, user._id, peerUserId);
    if (!existingMessage) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (scope === "everyone") {
      if (existingMessage.senderId !== user._id) {
        return NextResponse.json(
          { error: "Only the sender can delete for everyone" },
          { status: 403 }
        );
      }

      await dbQuery(`DELETE FROM messages WHERE id = $1`, [parsedMessageId]);

      const pusherServer = getPusherServer();
      if (pusherServer) {
        try {
          await pusherServer.trigger(getUserChannelName(peerUserId), MESSAGE_EVENTS.DELETED, {
            messageId: String(parsedMessageId),
            scope: "everyone",
            peerUserId: user._id,
            deletedBy: user._id,
          });
        } catch {
          // Deletion should still succeed without realtime.
        }
      }

      return NextResponse.json(
        {
          success: true,
          messageId: String(parsedMessageId),
          scope: "everyone",
        },
        { status: 200 }
      );
    }

    const isSender = existingMessage.senderId === user._id;
    const updateColumn = isSender ? "deleted_by_sender" : "deleted_by_receiver";

    await dbQuery(`UPDATE messages SET ${updateColumn} = TRUE WHERE id = $1`, [parsedMessageId]);

    await dbQuery(
      `
        DELETE FROM messages
        WHERE id = $1
          AND deleted_by_sender = TRUE
          AND deleted_by_receiver = TRUE
      `,
      [parsedMessageId]
    );

    return NextResponse.json(
      {
        success: true,
        messageId: String(parsedMessageId),
        scope: "me",
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
