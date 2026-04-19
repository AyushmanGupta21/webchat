import { NextResponse } from "next/server";
import { mapUserRowToApiUser, requireAuth } from "@/server/auth.js";
import { dbQuery } from "@/server/db.js";
import { areUsersFriends, getFriendPair } from "@/server/friends.js";

export async function PATCH(request, { params }) {
  try {
    const { user, response } = await requireAuth(request);
    if (response) return response;

    const { requestId } = await params;
    if (!requestId) {
      return NextResponse.json({ message: "Request id is required" }, { status: 400 });
    }

    const payload = await request.json().catch(() => ({}));
    const action = String(payload?.action || "").toLowerCase();
    if (action !== "accept" && action !== "reject") {
      return NextResponse.json({ message: "Invalid request action" }, { status: 400 });
    }

    const friendRequestResult = await dbQuery(
      `
        SELECT
          id,
          sender_id AS "senderId",
          receiver_id AS "receiverId",
          status
        FROM friend_requests
        WHERE id = $1
        LIMIT 1
      `,
      [requestId]
    );

    if (friendRequestResult.rowCount === 0) {
      return NextResponse.json({ message: "Friend request not found" }, { status: 404 });
    }

    const friendRequest = friendRequestResult.rows[0];

    if (friendRequest.receiverId !== user._id) {
      return NextResponse.json({ message: "You are not allowed to update this request" }, { status: 403 });
    }

    if (friendRequest.status !== "pending") {
      return NextResponse.json({ message: "Friend request is already resolved" }, { status: 409 });
    }

    if (action === "accept") {
      const alreadyFriends = await areUsersFriends(friendRequest.senderId, friendRequest.receiverId);
      if (!alreadyFriends) {
        const [userAId, userBId] = getFriendPair(friendRequest.senderId, friendRequest.receiverId);
        await dbQuery(
          `
            INSERT INTO friendships (user_a_id, user_b_id)
            VALUES ($1, $2)
            ON CONFLICT (user_a_id, user_b_id) DO NOTHING
          `,
          [userAId, userBId]
        );
      }

      await dbQuery(
        `
          UPDATE friend_requests
          SET status = 'accepted',
              updated_at = NOW(),
              responded_at = NOW()
          WHERE id = $1
        `,
        [requestId]
      );

      await dbQuery(
        `
          UPDATE friend_requests
          SET status = 'canceled',
              updated_at = NOW(),
              responded_at = NOW()
          WHERE sender_id = $1
            AND receiver_id = $2
            AND status = 'pending'
        `,
        [friendRequest.receiverId, friendRequest.senderId]
      );

      const friendResult = await dbQuery(
        `
          SELECT id, full_name, email, profile_pic, created_at
          FROM users
          WHERE id = $1
          LIMIT 1
        `,
        [friendRequest.senderId]
      );

      return NextResponse.json(
        {
          success: true,
          action: "accept",
          friend: friendResult.rowCount > 0 ? mapUserRowToApiUser(friendResult.rows[0]) : null,
        },
        { status: 200 }
      );
    }

    await dbQuery(
      `
        UPDATE friend_requests
        SET status = 'rejected',
            updated_at = NOW(),
            responded_at = NOW()
        WHERE id = $1
      `,
      [requestId]
    );

    return NextResponse.json({ success: true, action: "reject" }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Failed to update friend request" }, { status: 500 });
  }
}
