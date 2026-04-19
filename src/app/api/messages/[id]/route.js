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
        FROM messages
        WHERE (sender_id = $1 AND receiver_id = $2)
           OR (sender_id = $2 AND receiver_id = $1)
        ORDER BY created_at ASC
      `,
      [user._id, userToChatId]
    );

    return NextResponse.json(messages.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
