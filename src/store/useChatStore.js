import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { CHAT_EVENTS, MESSAGE_EVENTS, getUserChannelName } from "@/lib/realtime";

const messageBelongsToChat = (message, authUserId, selectedUserId) => {
  if (!message || !authUserId || !selectedUserId) return false;

  const senderId = message.senderId;
  const receiverId = message.receiverId;

  return (
    (senderId === authUserId && receiverId === selectedUserId) ||
    (senderId === selectedUserId && receiverId === authUserId)
  );
};

const normalizeErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  fallbackMessage;

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  friendRequestsIncoming: [],
  friendRequestsOutgoing: [],
  selectedUser: null,
  isUsersLoading: false,
  isFriendRequestsLoading: false,
  isSendingFriendRequest: false,
  isRespondingFriendRequest: false,
  isMessagesLoading: false,
  isWallpaperLoading: false,
  isWallpaperSaving: false,
  chatWallpaper: null,
  focusedMessageId: null,
  replyToMessage: null,
  editingMessage: null,
  subscribedChannelName: null,
  realtimeHandlers: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(normalizeErrorMessage(error, "Failed to load friends"));
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getFriendRequests: async () => {
    set({ isFriendRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/friends/requests");
      set({
        friendRequestsIncoming: res.data?.incoming || [],
        friendRequestsOutgoing: res.data?.outgoing || [],
      });
    } catch (error) {
      toast.error(normalizeErrorMessage(error, "Failed to load friend requests"));
    } finally {
      set({ isFriendRequestsLoading: false });
    }
  },

  sendFriendRequest: async (email) => {
    set({ isSendingFriendRequest: true });
    try {
      const res = await axiosInstance.post("/friends/request", { email });
      await get().getFriendRequests();
      return res.data?.request || null;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to send friend request");
      throw new Error(message);
    } finally {
      set({ isSendingFriendRequest: false });
    }
  },

  respondToFriendRequest: async (requestId, action) => {
    set({ isRespondingFriendRequest: true });
    try {
      const res = await axiosInstance.patch(`/friends/requests/${requestId}`, { action });

      if (action === "accept") {
        await get().getUsers();
      }

      await get().getFriendRequests();
      return res.data;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to update friend request");
      throw new Error(message);
    } finally {
      set({ isRespondingFriendRequest: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(normalizeErrorMessage(error, "Failed to load messages"));
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
      return res.data;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to send message");
      throw new Error(message);
    }
  },

  updateMessage: async (messageId, text) => {
    const { selectedUser } = get();
    try {
      const res = await axiosInstance.patch(`/messages/${selectedUser._id}/${messageId}`, {
        text,
      });

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === res.data._id ? res.data : message
        ),
        editingMessage:
          state.editingMessage?._id === res.data._id ? null : state.editingMessage,
      }));

      return res.data;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to edit message");
      throw new Error(message);
    }
  },

  deleteMessage: async (messageId, scope = "me") => {
    const { selectedUser } = get();
    try {
      await axiosInstance.delete(`/messages/${selectedUser._id}/${messageId}`, {
        params: { scope },
      });

      set((state) => ({
        messages: state.messages.filter((message) => message._id !== String(messageId)),
        replyToMessage:
          state.replyToMessage?._id === String(messageId) ? null : state.replyToMessage,
        editingMessage:
          state.editingMessage?._id === String(messageId) ? null : state.editingMessage,
      }));
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to delete message");
      throw new Error(message);
    }
  },

  toggleReaction: async (messageId, emoji) => {
    const { selectedUser } = get();
    try {
      const res = await axiosInstance.post(`/messages/${selectedUser._id}/${messageId}/reactions`, {
        emoji,
      });

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === res.data.messageId
            ? {
                ...message,
                reactions: res.data.reactions,
              }
            : message
        ),
      }));

      return res.data;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to update reaction");
      throw new Error(message);
    }
  },

  searchMessages: async ({ query = "", date = "", userId = "" } = {}) => {
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (date) params.date = date;
      if (userId) params.userId = userId;

      const res = await axiosInstance.get("/messages/search", { params });
      return res.data;
    } catch (error) {
      toast.error(normalizeErrorMessage(error, "Failed to search messages"));
      return [];
    }
  },

  getChatWallpaper: async (peerUserId) => {
    if (!peerUserId) {
      set({ chatWallpaper: null, isWallpaperLoading: false });
      return null;
    }

    set({ isWallpaperLoading: true });
    try {
      const res = await axiosInstance.get(`/chats/${peerUserId}/wallpaper`);
      set({ chatWallpaper: res.data?.wallpaper || null });
      return res.data?.wallpaper || null;
    } catch (error) {
      set({ chatWallpaper: null });
      return null;
    } finally {
      set({ isWallpaperLoading: false });
    }
  },

  setChatWallpaper: async (peerUserId, payload) => {
    set({ isWallpaperSaving: true });
    try {
      const res = await axiosInstance.put(`/chats/${peerUserId}/wallpaper`, payload);
      set({ chatWallpaper: res.data?.wallpaper || null });
      return res.data?.wallpaper || null;
    } catch (error) {
      const message = normalizeErrorMessage(error, "Failed to save wallpaper");
      throw new Error(message);
    } finally {
      set({ isWallpaperSaving: false });
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const { realtimeClient, authUser } = useAuthStore.getState();
    if (!realtimeClient || !authUser) return;

    const channelName = getUserChannelName(authUser._id);
    const channel = realtimeClient.channel(channelName) || realtimeClient.subscribe(channelName);

    const previousHandlers = get().realtimeHandlers;
    const previousChannelName = get().subscribedChannelName;
    if (previousHandlers && previousChannelName === channelName) {
      channel.unbind(MESSAGE_EVENTS.NEW, previousHandlers.onNewMessage);
      channel.unbind(MESSAGE_EVENTS.UPDATED, previousHandlers.onMessageUpdated);
      channel.unbind(MESSAGE_EVENTS.DELETED, previousHandlers.onMessageDeleted);
      channel.unbind(MESSAGE_EVENTS.REACTION, previousHandlers.onMessageReaction);
      channel.unbind(CHAT_EVENTS.WALLPAPER_UPDATED, previousHandlers.onWallpaperUpdated);
    }

    const onNewMessage = (newMessage) => {
      const currentSelectedUserId = get().selectedUser?._id;
      if (!messageBelongsToChat(newMessage, authUser._id, currentSelectedUserId)) return;

      set({
        messages: get().messages.some((message) => message._id === newMessage._id)
          ? get().messages
          : [...get().messages, newMessage],
      });
    };

    const onMessageUpdated = (payload) => {
      const nextMessage = payload?.message;
      const currentSelectedUserId = get().selectedUser?._id;
      if (!messageBelongsToChat(nextMessage, authUser._id, currentSelectedUserId)) return;

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === nextMessage._id ? nextMessage : message
        ),
      }));
    };

    const onMessageDeleted = (payload) => {
      const currentSelectedUserId = get().selectedUser?._id;
      if (!currentSelectedUserId || payload?.peerUserId !== currentSelectedUserId) return;

      set((state) => ({
        messages: state.messages.filter((message) => message._id !== payload?.messageId),
        replyToMessage:
          state.replyToMessage?._id === payload?.messageId ? null : state.replyToMessage,
        editingMessage:
          state.editingMessage?._id === payload?.messageId ? null : state.editingMessage,
      }));
    };

    const onMessageReaction = (payload) => {
      const currentSelectedUserId = get().selectedUser?._id;
      if (!currentSelectedUserId || payload?.peerUserId !== currentSelectedUserId) return;

      set((state) => ({
        messages: state.messages.map((message) =>
          message._id === payload?.messageId
            ? {
                ...message,
                reactions: Array.isArray(payload?.reactions) ? payload.reactions : message.reactions,
              }
            : message
        ),
      }));
    };

    const onWallpaperUpdated = (payload) => {
      const currentSelectedUserId = get().selectedUser?._id;
      if (!currentSelectedUserId || payload?.peerUserId !== currentSelectedUserId) return;

      set({ chatWallpaper: payload?.wallpaper || null });
    };

    channel.bind(MESSAGE_EVENTS.NEW, onNewMessage);
    channel.bind(MESSAGE_EVENTS.UPDATED, onMessageUpdated);
    channel.bind(MESSAGE_EVENTS.DELETED, onMessageDeleted);
    channel.bind(MESSAGE_EVENTS.REACTION, onMessageReaction);
    channel.bind(CHAT_EVENTS.WALLPAPER_UPDATED, onWallpaperUpdated);

    set({
      subscribedChannelName: channelName,
      realtimeHandlers: {
        onNewMessage,
        onMessageUpdated,
        onMessageDeleted,
        onMessageReaction,
        onWallpaperUpdated,
      },
    });
  },

  unsubscribeFromMessages: () => {
    const { realtimeClient } = useAuthStore.getState();
    const { subscribedChannelName, realtimeHandlers } = get();

    if (!realtimeClient || !subscribedChannelName || !realtimeHandlers) return;

    const channel = realtimeClient.channel(subscribedChannelName);
    if (channel) {
      channel.unbind(MESSAGE_EVENTS.NEW, realtimeHandlers.onNewMessage);
      channel.unbind(MESSAGE_EVENTS.UPDATED, realtimeHandlers.onMessageUpdated);
      channel.unbind(MESSAGE_EVENTS.DELETED, realtimeHandlers.onMessageDeleted);
      channel.unbind(MESSAGE_EVENTS.REACTION, realtimeHandlers.onMessageReaction);
      channel.unbind(CHAT_EVENTS.WALLPAPER_UPDATED, realtimeHandlers.onWallpaperUpdated);
    }

    set({ subscribedChannelName: null, realtimeHandlers: null });
  },

  setFocusedMessage: (focusedMessageId) => set({ focusedMessageId }),
  setReplyToMessage: (replyToMessage) => set({ replyToMessage }),
  beginEditMessage: (editingMessage) => set({ editingMessage }),
  cancelEditMessage: () => set({ editingMessage: null }),

  setSelectedUser: (selectedUser) =>
    set((state) => {
      const previousUserId = state.selectedUser?._id || null;
      const nextUserId = selectedUser?._id || null;

      // Clicking the already selected chat should not clear wallpaper/state.
      if (previousUserId && nextUserId && previousUserId === nextUserId) {
        return state;
      }

      return {
        selectedUser,
        replyToMessage: null,
        editingMessage: null,
        focusedMessageId: null,
        chatWallpaper: null,
      };
    }),
}));
