import { NextResponse } from "next/server";
import { mapUserRowToApiUser, requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";

export async function GET(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const incomingResult = await dbQuery(
      `
        SELECT
          fr.id AS request_id,
          fr.created_at AS "createdAt",
          u.id AS user_id,
          u.full_name AS user_full_name,
          u.email AS user_email,
          u.profile_pic AS user_profile_pic,
          u.created_at AS user_created_at
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.sender_id
        WHERE fr.receiver_id = $1
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `,
      [user._id]
    );

    const outgoingResult = await dbQuery(
      `
        SELECT
          fr.id AS request_id,
          fr.created_at AS "createdAt",
          u.id AS user_id,
          u.full_name AS user_full_name,
          u.email AS user_email,
          u.profile_pic AS user_profile_pic,
          u.created_at AS user_created_at
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.receiver_id
        WHERE fr.sender_id = $1
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `,
      [user._id]
    );

    const incoming = incomingResult.rows.map((row) => ({
      id: row.request_id,
      createdAt: row.createdAt,
      user: mapUserRowToApiUser({
        id: row.user_id,
        full_name: row.user_full_name,
        email: row.user_email,
        profile_pic: row.user_profile_pic,
        created_at: row.user_created_at,
      }),
    }));

    const outgoing = outgoingResult.rows.map((row) => ({
      id: row.request_id,
      createdAt: row.createdAt,
      user: mapUserRowToApiUser({
        id: row.user_id,
        full_name: row.user_full_name,
        email: row.user_email,
        profile_pic: row.user_profile_pic,
        created_at: row.user_created_at,
      }),
    }));

    return NextResponse.json({ incoming, outgoing }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to load friend requests" }, { status: 500 });
  }
}
