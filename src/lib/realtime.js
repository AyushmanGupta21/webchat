export const ONLINE_PRESENCE_CHANNEL = "presence-chatty-online";
export const USER_CHANNEL_PREFIX = "private-user-";

export function getUserChannelName(userId) {
  return `${USER_CHANNEL_PREFIX}${userId}`;
}
