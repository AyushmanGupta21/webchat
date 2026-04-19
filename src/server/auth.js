import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";
import { dbQuery } from "./db.js";

export function mapUserRowToApiUser(row) {
  return {
    _id: row.id,
    fullName: row.full_name,
    email: row.email,
    profilePic: row.profile_pic,
    createdAt: row.created_at,
  };
}

export function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function setAuthCookie(response, token) {
  response.cookies.set("jwt", token, {
    maxAge: 7 * 24 * 60 * 60,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV !== "development",
    path: "/",
  });
}

export function clearAuthCookie(response) {
  response.cookies.set("jwt", "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV !== "development",
    path: "/",
  });
}

export async function requireAuth(request) {
  try {
    const token = request.cookies.get("jwt")?.value;

    if (!token) {
      return {
        response: NextResponse.json({ message: "Unauthorized - No Token Provided" }, { status: 401 }),
      };
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userResult = await dbQuery(
      `SELECT id, full_name, email, profile_pic, created_at FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (userResult.rowCount === 0) {
      return { response: NextResponse.json({ message: "User not found" }, { status: 404 }) };
    }

    return { user: mapUserRowToApiUser(userResult.rows[0]) };
  } catch (error) {
    return {
      response: NextResponse.json({ message: "Internal server error" }, { status: 500 }),
      error,
    };
  }
}
