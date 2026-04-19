import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import cloudinary from "@/server/cloudinary.js";
import { dbQuery } from "@/server/db.js";
import { getPusherServer } from "@/server/pusher.js";
import { areUsersFriends } from "@/server/friends.js";
import { MESSAGE_EVENTS, getUserChannelName } from "@/lib/realtime.js";

async function resolveReplyMessage(replyToMessageId, senderId, receiverId) {
  if (!replyToMessageId) return null;

  const parsedId = Number.parseInt(String(replyToMessageId), 10);
  if (!Number.isFinite(parsedId)) {
    throw new Error("Invalid reply target");
  }

  const replyMessageResult = await dbQuery(
    `
      SELECT
        id::text AS "_id",
        sender_id AS "senderId",
        receiver_id AS "receiverId",
        text,
        image_url AS image,
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
    [parsedId, senderId, receiverId]
  );

  if (replyMessageResult.rowCount === 0) {
    throw new Error("Reply message was not found in this chat");
  }

  const replyMessage = replyMessageResult.rows[0];
  const isDeletedForSender = replyMessage.senderId === senderId && replyMessage.deletedBySender;
  const isDeletedForReceiver = replyMessage.receiverId === senderId && replyMessage.deletedByReceiver;

  if (isDeletedForSender || isDeletedForReceiver) {
    throw new Error("Cannot reply to a deleted message");
  }

  return {
    id: Number.parseInt(replyMessage._id, 10),
    preview: {
      _id: replyMessage._id,
      senderId: replyMessage.senderId,
      text: replyMessage.text,
      image: replyMessage.image,
    },
  };
}

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { text, image, mediaMeta, replyToMessageId } = await request.json();
    const { id: receiverId } = await params;
    const normalizedText = typeof text === "string" ? text.trim() : "";

    const isFriend = await areUsersFriends(user._id, receiverId);
    if (!isFriend) {
      return NextResponse.json({ error: "You can chat only with friends" }, { status: 403 });
    }

    if (!normalizedText && !image) {
      return NextResponse.json({ error: "Message text or media is required" }, { status: 400 });
    }

    let imageUrl;
    if (image) {
      const isCloudinaryAsset =
        typeof image === "string" && image.startsWith("https://res.cloudinary.com/");

      if (isCloudinaryAsset) {
        imageUrl = image;
      } else {
        const uploadResponse = await cloudinary.uploader.upload(image, {
          resource_type: mediaMeta?.mimeType?.startsWith("video/") ? "video" : "image",
          folder: "chat-media",
        });

        imageUrl = uploadResponse.secure_url;
      }
    }

    const replyMessageMeta = await resolveReplyMessage(replyToMessageId, user._id, receiverId);

    const createdMessage = await dbQuery(
      `
        INSERT INTO messages (
          sender_id,
          receiver_id,
          text,
          image_url,
          image_encrypted,
          image_iv,
          image_mime_type,
          image_file_name,
          reply_to_message_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING
          id::text AS "_id",
          sender_id AS "senderId",
          receiver_id AS "receiverId",
          text,
          image_url AS image,
          image_encrypted AS "imageEncrypted",
          image_iv AS "imageIv",
          image_mime_type AS "imageMimeType",
          image_file_name AS "imageFileName",
          reply_to_message_id::text AS "replyToMessageId",
          edited_at AS "editedAt",
          created_at AS "createdAt"
      `,
      [
        user._id,
        receiverId,
        normalizedText || null,
        imageUrl || null,
        false,
        null,
        mediaMeta?.mimeType || null,
        mediaMeta?.fileName || null,
        replyMessageMeta?.id || null,
      ]
    );

    const newMessage = {
      ...createdMessage.rows[0],
      reactions: [],
      replyToMessage: replyMessageMeta?.preview || null,
    };

    const pusherServer = getPusherServer();
    if (pusherServer) {
      try {
        await pusherServer.trigger(getUserChannelName(receiverId), MESSAGE_EVENTS.NEW, newMessage);
      } catch {
        // Do not fail message persistence if realtime delivery is temporarily unavailable.
      }
    }

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
