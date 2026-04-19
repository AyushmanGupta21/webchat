export const ONLINE_PRESENCE_CHANNEL = "presence-chatty-online";
export const USER_CHANNEL_PREFIX = "private-user-";
export const CALL_SIGNAL_EVENT = "call:signal";

export const CALL_SIGNAL_TYPES = {
  OFFER: "offer",
  ANSWER: "answer",
  ICE_CANDIDATE: "ice-candidate",
  REJECT: "reject",
  HANGUP: "hangup",
  BUSY: "busy",
};

export function getUserChannelName(userId) {
  return `${USER_CHANNEL_PREFIX}${userId}`;
}
