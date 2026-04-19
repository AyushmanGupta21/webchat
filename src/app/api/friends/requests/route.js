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
          fr.id,
          fr.created_at AS "createdAt",
          u.id,
          u.full_name,
          u.email,
          u.profile_pic,
          u.created_at
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
          fr.id,
          fr.created_at AS "createdAt",
          u.id,
          u.full_name,
          u.email,
          u.profile_pic,
          u.created_at
        FROM friend_requests fr
        INNER JOIN users u ON u.id = fr.receiver_id
        WHERE fr.sender_id = $1
          AND fr.status = 'pending'
        ORDER BY fr.created_at DESC
      `,
      [user._id]
    );

    const incoming = incomingResult.rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      user: mapUserRowToApiUser(row),
    }));

    const outgoing = outgoingResult.rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      user: mapUserRowToApiUser(row),
    }));

    return NextResponse.json({ incoming, outgoing }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to load friend requests" }, { status: 500 });
  }
}
