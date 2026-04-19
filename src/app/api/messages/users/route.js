import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { mapUserRowToApiUser } from "@/server/auth.js";

export async function GET(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const friends = await dbQuery(
      `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.profile_pic,
          u.created_at
        FROM friendships f
        INNER JOIN users u
          ON u.id = CASE WHEN f.user_a_id = $1 THEN f.user_b_id ELSE f.user_a_id END
        WHERE f.user_a_id = $1 OR f.user_b_id = $1
        ORDER BY u.full_name ASC
      `,
      [user._id]
    );

    return NextResponse.json(friends.rows.map(mapUserRowToApiUser), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
