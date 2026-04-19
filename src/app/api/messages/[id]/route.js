import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";

export async function GET(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { id: userToChatId } = await params;
    const messages = await dbQuery(
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
        WHERE (
            (m.sender_id = $1 AND m.receiver_id = $2)
            OR (m.sender_id = $2 AND m.receiver_id = $1)
          )
          AND NOT (
            (m.sender_id = $1 AND m.deleted_by_sender = TRUE)
            OR (m.receiver_id = $1 AND m.deleted_by_receiver = TRUE)
          )
        ORDER BY m.created_at ASC
      `,
      [user._id, userToChatId]
    );

    return NextResponse.json(messages.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
