import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const url = new URL(request.url);
    const query = String(url.searchParams.get("q") || "").trim();
    const date = String(url.searchParams.get("date") || "").trim();
    const userId = String(url.searchParams.get("userId") || "").trim();

    if (!query && !date) {
      return NextResponse.json([], { status: 200 });
    }

    if (date && !DATE_PATTERN.test(date)) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }

    const params = [user._id];
    let index = 2;

    const conditions = [
      `(
        m.sender_id = $1
        OR m.receiver_id = $1
      )`,
      `NOT (
        (m.sender_id = $1 AND m.deleted_by_sender = TRUE)
        OR (m.receiver_id = $1 AND m.deleted_by_receiver = TRUE)
      )`,
    ];

    if (userId) {
      conditions.push(
        `(
          (m.sender_id = $1 AND m.receiver_id = $${index})
          OR (m.sender_id = $${index} AND m.receiver_id = $1)
        )`
      );
      params.push(userId);
      index += 1;
    }

    if (query) {
      conditions.push(`COALESCE(m.text, '') ILIKE $${index}`);
      params.push(`%${query}%`);
      index += 1;
    }

    if (date) {
      conditions.push(`m.created_at::date = $${index}::date`);
      params.push(date);
      index += 1;
    }

    const searchResults = await dbQuery(
      `
        SELECT
          m.id::text AS "_id",
          m.text,
          m.image_url AS image,
          m.created_at AS "createdAt",
          m.sender_id AS "senderId",
          m.receiver_id AS "receiverId",
          CASE
            WHEN m.sender_id = $1 THEN m.receiver_id
            ELSE m.sender_id
          END AS "chatUserId",
          u.full_name AS "chatUserFullName",
          u.profile_pic AS "chatUserProfilePic"
        FROM messages m
        INNER JOIN users u ON u.id = CASE
          WHEN m.sender_id = $1 THEN m.receiver_id
          ELSE m.sender_id
        END
        WHERE ${conditions.join(" AND ")}
        ORDER BY m.created_at DESC
        LIMIT 80
      `,
      params
    );

    return NextResponse.json(searchResults.rows, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
