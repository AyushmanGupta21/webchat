import { NextResponse } from "next/server";
import { mapUserRowToApiUser, requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { areUsersFriends } from "@/server/friends.js";

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const payload = await request.json().catch(() => ({}));
    const email = normalizeEmail(payload?.email);

    if (!isValidEmail(email)) {
      return NextResponse.json({ message: "A valid friend email is required" }, { status: 400 });
    }

    const receiverResult = await dbQuery(
      `
        SELECT id, full_name, email, profile_pic, created_at
        FROM users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );

    if (receiverResult.rowCount === 0) {
      return NextResponse.json({ message: "No user found with this email" }, { status: 404 });
    }

    const receiver = receiverResult.rows[0];

    if (receiver.id === user._id) {
      return NextResponse.json({ message: "You cannot send a friend request to yourself" }, { status: 400 });
    }

    const alreadyFriends = await areUsersFriends(user._id, receiver.id);
    if (alreadyFriends) {
      return NextResponse.json({ message: "You are already friends" }, { status: 409 });
    }

    const incomingRequest = await dbQuery(
      `
        SELECT id
        FROM friend_requests
        WHERE sender_id = $1
          AND receiver_id = $2
          AND status = 'pending'
        LIMIT 1
      `,
      [receiver.id, user._id]
    );

    if (incomingRequest.rowCount > 0) {
      return NextResponse.json(
        { message: "This user already sent you a friend request. Check your requests." },
        { status: 409 }
      );
    }

    const outgoingRequest = await dbQuery(
      `
        SELECT id
        FROM friend_requests
        WHERE sender_id = $1
          AND receiver_id = $2
          AND status = 'pending'
        LIMIT 1
      `,
      [user._id, receiver.id]
    );

    if (outgoingRequest.rowCount > 0) {
      return NextResponse.json({ message: "Friend request already sent" }, { status: 409 });
    }

    const createdRequest = await dbQuery(
      `
        INSERT INTO friend_requests (sender_id, receiver_id, status, updated_at)
        VALUES ($1, $2, 'pending', NOW())
        RETURNING id, created_at AS "createdAt"
      `,
      [user._id, receiver.id]
    );

    return NextResponse.json(
      {
        request: {
          id: createdRequest.rows[0].id,
          createdAt: createdRequest.rows[0].createdAt,
          user: mapUserRowToApiUser(receiver),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ message: "Failed to send friend request" }, { status: 500 });
  }
}
