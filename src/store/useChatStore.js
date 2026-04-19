import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "@/lib/axios";
import { useAuthStore } from "@/store/useAuthStore";
import { getUserChannelName } from "@/lib/realtime";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  subscribedChannelName: null,
  newMessageHandler: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },
  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const { realtimeClient, authUser } = useAuthStore.getState();
    if (!realtimeClient || !authUser) return;

    const channelName = getUserChannelName(authUser._id);
    const channel = realtimeClient.channel(channelName) || realtimeClient.subscribe(channelName);

    const previousHandler = get().newMessageHandler;
    const previousChannelName = get().subscribedChannelName;
    if (previousHandler && previousChannelName === channelName) {
      channel.unbind("newMessage", previousHandler);
    }

    const onNewMessage = (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;

      set({
        messages: [...get().messages, newMessage],
      });
    };

    channel.bind("newMessage", onNewMessage);

    set({
      subscribedChannelName: channelName,
      newMessageHandler: onNewMessage,
    });
  },

  unsubscribeFromMessages: () => {
    const { realtimeClient } = useAuthStore.getState();
    const { subscribedChannelName, newMessageHandler } = get();

    if (!realtimeClient || !subscribedChannelName || !newMessageHandler) return;

    const channel = realtimeClient.channel(subscribedChannelName);
    if (channel) {
      channel.unbind("newMessage", newMessageHandler);
    }

    set({ subscribedChannelName: null, newMessageHandler: null });
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));
