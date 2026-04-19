import { create } from "zustand";
import { axiosInstance } from "@/lib/axios.js";
import toast from "react-hot-toast";
import Pusher from "pusher-js";
import { ONLINE_PRESENCE_CHANNEL } from "@/lib/realtime";

const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
const AUTH_USER_STORAGE_KEY = "chat-auth-user-v1";

function readCachedAuthUser() {
  if (typeof window === "undefined") return null;

  const rawUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);
  if (!rawUser) return null;

  try {
    const parsedUser = JSON.parse(rawUser);
    if (parsedUser && typeof parsedUser === "object" && parsedUser._id) {
      return parsedUser;
    }
  } catch {
    // Ignore malformed cache and treat user as signed out.
  }

  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  return null;
}

function cacheAuthUser(user) {
  if (typeof window === "undefined") return;

  if (!user) {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
}

const initialAuthUser = readCachedAuthUser();

export const useAuthStore = create((set, get) => ({
  authUser: initialAuthUser,
  isSigningUp: false,
  isLoggingIn: false,
  isResettingPassword: false,
  isUpdatingProfile: false,
  isCheckingAuth: !initialAuthUser,
  onlineUsers: [],
  realtimeClient: null,
  presenceChannel: null,
  presenceHandlers: null,

  checkAuth: async () => {
    const hasCachedUser = Boolean(get().authUser);
    if (!hasCachedUser) {
      set({ isCheckingAuth: true });
    }

    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      cacheAuthUser(res.data);
      get().connectSocket();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      set({ authUser: null });
      cacheAuthUser(null);
      get().disconnectSocket();
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      cacheAuthUser(res.data);
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to sign up");
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      cacheAuthUser(res.data);
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to log in");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  resetPassword: async (data) => {
    set({ isResettingPassword: true });
    try {
      await axiosInstance.post("/auth/reset-password", data);
      toast.success("Password reset successfully");
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to reset password");
      return false;
    } finally {
      set({ isResettingPassword: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      cacheAuthUser(null);
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to log out");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      cacheAuthUser(res.data);
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error?.response?.data?.message || "Failed to update profile");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().realtimeClient) return;

    if (!PUSHER_KEY || !PUSHER_CLUSTER) {
      set({ onlineUsers: [authUser._id] });
      return;
    }

    const realtimeClient = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      channelAuthorization: {
        endpoint: "/api/realtime/auth",
        transport: "ajax",
      },
    });

    const presenceChannel = realtimeClient.subscribe(ONLINE_PRESENCE_CHANNEL);

    const onSubscriptionSucceeded = (members) => {
      const activeUsers = [];
      members.each((member) => {
        activeUsers.push(String(member.id));
      });

      set({ onlineUsers: activeUsers });
    };

    const onMemberAdded = (member) => {
      const memberId = String(member.id);
      set((state) => ({
        onlineUsers: state.onlineUsers.includes(memberId)
          ? state.onlineUsers
          : [...state.onlineUsers, memberId],
      }));
    };

    const onMemberRemoved = (member) => {
      const memberId = String(member.id);
      set((state) => ({
        onlineUsers: state.onlineUsers.filter((id) => id !== memberId),
      }));
    };

    presenceChannel.bind("pusher:subscription_succeeded", onSubscriptionSucceeded);
    presenceChannel.bind("pusher:member_added", onMemberAdded);
    presenceChannel.bind("pusher:member_removed", onMemberRemoved);

    set({
      realtimeClient,
      presenceChannel,
      presenceHandlers: {
        onSubscriptionSucceeded,
        onMemberAdded,
        onMemberRemoved,
      },
    });
  },
  disconnectSocket: () => {
    const { realtimeClient, presenceChannel, presenceHandlers } = get();

    if (presenceChannel && presenceHandlers) {
      presenceChannel.unbind("pusher:subscription_succeeded", presenceHandlers.onSubscriptionSucceeded);
      presenceChannel.unbind("pusher:member_added", presenceHandlers.onMemberAdded);
      presenceChannel.unbind("pusher:member_removed", presenceHandlers.onMemberRemoved);
    }

    if (realtimeClient) {
      realtimeClient.unsubscribe(ONLINE_PRESENCE_CHANNEL);
      realtimeClient.disconnect();
    }

    set({
      realtimeClient: null,
      presenceChannel: null,
      presenceHandlers: null,
      onlineUsers: [],
    });
  },
}));
