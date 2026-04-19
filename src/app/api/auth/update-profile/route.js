import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth.js";
import cloudinary from "@/server/cloudinary.js";
import { dbQuery } from "@/server/db.js";
import { mapUserRowToApiUser } from "@/server/auth.js";

export async function PUT(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { profilePic } = await request.json();
    if (!profilePic) {
      return NextResponse.json({ message: "Profile pic is required" }, { status: 400 });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);

    const updatedUser = await dbQuery(
      `
        UPDATE users
        SET profile_pic = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, full_name, email, profile_pic, created_at
      `,
      [uploadResponse.secure_url, user._id]
    );

    return NextResponse.json(mapUserRowToApiUser(updatedUser.rows[0]), { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
