import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import cloudinary from "@/server/cloudinary.js";
import { dbQuery } from "@/server/db.js";
import { getPusherServer } from "@/server/pusher.js";
import { getUserChannelName } from "@/lib/realtime.js";

export async function POST(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { text, image, mediaMeta } = await request.json();
    const { id: receiverId } = await params;
    const normalizedText = typeof text === "string" ? text.trim() : "";

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
          image_file_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ]
    );

    const newMessage = createdMessage.rows[0];

    const pusherServer = getPusherServer();
    if (pusherServer) {
      try {
        await pusherServer.trigger(getUserChannelName(receiverId), "newMessage", newMessage);
      } catch {
        // Do not fail message persistence if realtime delivery is temporarily unavailable.
      }
    }

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
