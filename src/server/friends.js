import { dbQuery } from "@/server/db.js";

export function getFriendPair(userIdA, userIdB) {
  const first = String(userIdA || "");
  const second = String(userIdB || "");

  return first < second ? [first, second] : [second, first];
}

export async function areUsersFriends(userIdA, userIdB) {
  if (!userIdA || !userIdB) return false;
  if (String(userIdA) === String(userIdB)) return false;

  const [userAId, userBId] = getFriendPair(userIdA, userIdB);
  const friendship = await dbQuery(
    `
      SELECT 1
      FROM friendships
      WHERE user_a_id = $1 AND user_b_id = $2
      LIMIT 1
    `,
    [userAId, userBId]
  );

  return friendship.rowCount > 0;
}
