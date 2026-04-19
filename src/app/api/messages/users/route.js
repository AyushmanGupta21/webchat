import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { mapUserRowToApiUser } from "@/server/auth.js";

export async function GET(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const filteredUsers = await dbQuery(
      `
        SELECT id, full_name, email, profile_pic, created_at
        FROM users
        WHERE id <> $1
        ORDER BY full_name ASC
      `,
      [user._id]
    );

    return NextResponse.json(filteredUsers.rows.map(mapUserRowToApiUser), { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
