import { useEffect, useMemo, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import {
  Bell,
  Bookmark,
  Check,
  Clock3,
  LogOut,
  Menu,
  Phone,
  Search,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useThemeStore } from "@/store/useThemeStore";
import toast from "react-hot-toast";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    getFriendRequests,
    friendRequestsIncoming,
    friendRequestsOutgoing,
    isFriendRequestsLoading,
    isSendingFriendRequest,
    isRespondingFriendRequest,
    sendFriendRequest,
    respondToFriendRequest,
  } = useChatStore();
  const { onlineUsers, authUser, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [friendSearchTerm, setFriendSearchTerm] = useState("");
  const [friendEmail, setFriendEmail] = useState("");

  useEffect(() => {
    getUsers();
    getFriendRequests();
  }, [getUsers, getFriendRequests]);

  useEffect(() => {
    const refreshTimer = window.setInterval(() => {
      getFriendRequests({ silent: true });
      getUsers({ silent: true });
    }, 15000);

    return () => window.clearInterval(refreshTimer);
  }, [getFriendRequests, getUsers]);

  const filteredUsers = useMemo(() => {
    const keyword = friendSearchTerm.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((friend) => {
      const fullName = String(friend.fullName || "").toLowerCase();
      const email = String(friend.email || "").toLowerCase();
      return fullName.includes(keyword) || email.includes(keyword);
    });
  }, [friendSearchTerm, users]);

  const handleSendFriendRequest = async (event) => {
    event.preventDefault();

    const nextEmail = friendEmail.trim();
    if (!nextEmail) {
      toast.error("Enter your friend's email first");
      return;
    }

    try {
      await sendFriendRequest(nextEmail);
      toast.success("Friend request sent");
      setFriendEmail("");
    } catch (error) {
      toast.error(error?.message || "Failed to send friend request");
    }
  };

  const handleRespondFriendRequest = async (requestId, action) => {
    try {
      await respondToFriendRequest(requestId, action);
      toast.success(action === "accept" ? "Friend request accepted" : "Friend request rejected");
    } catch (error) {
      toast.error(error?.message || "Failed to update friend request");
    }
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full md:w-[320px] lg:w-[400px] flex flex-col transition-all duration-200 bg-base-100 border-r border-base-300 relative">
      {/* Header section (friend search + add friend) */}
      <div className="flex items-center gap-3 p-3">
        <button 
          onClick={() => setIsDrawerOpen(true)}
          className="text-base-content/70 hover:text-base-content p-2 rounded-full hover:bg-base-300 transition-colors"
        >
          <Menu className="size-5" />
        </button>

        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="size-4 text-base-content/70" />
          </div>

          <input
            type="text"
            placeholder="Search friends"
            className="w-full bg-base-200 text-base-content placeholder-base-content/70 border-none rounded-full py-1.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
            value={friendSearchTerm}
            onChange={(event) => setFriendSearchTerm(event.target.value)}
          />
        </div>
      </div>

      <div className="px-3 pb-2">
        <form onSubmit={handleSendFriendRequest} className="rounded-xl border border-base-300 bg-base-100 p-2">
          <div className="text-xs font-medium text-base-content/70 mb-1">Add friend by email</div>
          <div className="flex items-center gap-2">
            <input
              type="email"
              className="input input-sm input-bordered w-full"
              placeholder="friend@gmail.com"
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
            />
            <button type="submit" className="btn btn-sm btn-primary" disabled={isSendingFriendRequest}>
              {isSendingFriendRequest ? <span className="loading loading-spinner loading-xs" /> : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="px-3 pb-2 space-y-2">
        {isFriendRequestsLoading && (
          <div className="rounded-xl border border-base-300 bg-base-100 p-3 text-sm text-base-content/70">
            Loading friend requests...
          </div>
        )}

        {friendRequestsIncoming.length > 0 && (
          <div className="rounded-xl border border-base-300 bg-base-100 p-2">
            <h4 className="px-1 py-1 text-xs font-semibold text-base-content/70 uppercase tracking-wide">
              Friend Requests
            </h4>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {friendRequestsIncoming.map((request) => (
                <div key={request.id} className="rounded-lg bg-base-200 p-2">
                  <div className="flex items-center gap-2 mb-2">
                    <img
                      src={request.user.profilePic || "/avatar.png"}
                      alt={request.user.fullName}
                      className="size-8 rounded-full border border-base-300"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{request.user.fullName}</p>
                      <p className="truncate text-xs text-base-content/60">{request.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="btn btn-xs btn-primary"
                      disabled={isRespondingFriendRequest}
                      onClick={() => handleRespondFriendRequest(request.id, "accept")}
                    >
                      <Check className="size-3" /> Accept
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      disabled={isRespondingFriendRequest}
                      onClick={() => handleRespondFriendRequest(request.id, "reject")}
                    >
                      <X className="size-3" /> Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friendRequestsOutgoing.length > 0 && (
          <div className="rounded-xl border border-base-300 bg-base-100 p-2">
            <h4 className="px-1 py-1 text-xs font-semibold text-base-content/70 uppercase tracking-wide">
              Pending Sent Requests
            </h4>

            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {friendRequestsOutgoing.map((request) => (
                <div key={request.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm">
                  <Clock3 className="size-3 text-base-content/60" />
                  <span className="truncate">{request.user.email}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Sliding Drawer */}
      <div 
        className={`fixed top-0 left-0 h-full w-[280px] bg-base-100 z-50 transform transition-transform duration-300 ease-in-out shadow-2xl flex flex-col ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-4 border-b border-base-300 space-y-4">
          <div className="flex justify-between items-start">
            <img src={authUser?.profilePic || "/avatar.png"} className="size-12 rounded-full cursor-pointer hover:opacity-80 transition" alt="Profile" />
          </div>
          <div>
            <h2 className="text-base-content font-medium">{authUser?.fullName || "User"}</h2>
            <p className="text-primary text-sm cursor-pointer hover:underline">Set Emoji Status</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          <Link href="/profile" className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <User className="size-5 text-base-content/70"/>
            <span className="font-medium">My Profile</span>
          </Link>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <Users className="size-5 text-base-content/70"/>
            <span className="font-medium">New Group</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <Bell className="size-5 text-base-content/70"/>
            <span className="font-medium">New Channel</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <User className="size-5 text-base-content/70"/>
            <span className="font-medium">Contacts</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <Phone className="size-5 text-base-content/70"/>
            <span className="font-medium">Calls</span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <Bookmark className="size-5 text-base-content/70"/>
            <span className="font-medium">Saved Messages</span>
          </div>
          <Link href="/settings" className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <Settings className="size-5 text-base-content/70"/>
            <span className="font-medium">Settings</span>
          </Link>
          
          <div className="flex items-center justify-between px-4 py-3 hover:bg-base-300 text-base-content transition cursor-pointer">
            <div className="flex items-center gap-4">
              <svg className="size-5 text-base-content/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <span className="font-medium">Night Mode</span>
            </div>
            <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={theme === "dark"} onChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>

          <div onClick={logout} className="flex items-center gap-4 px-4 py-3 hover:bg-base-300 text-error transition cursor-pointer mt-4 border-t border-base-300 pt-4">
            <LogOut className="size-5"/>
            <span className="font-medium">Log Out</span>
          </div>
        </div>

        <div className="p-4 text-xs text-base-content/70 border-t border-base-300">
          Chatty Desktop<br/>Version 1.0
        </div>
      </div>

      <div className="overflow-y-auto w-full py-1">
        {filteredUsers.map((user) => (
          <button
            key={user._id}
            onClick={() => setSelectedUser(user)}
            className={`
              w-full px-3 py-2.5 flex items-center gap-3 transition-colors
              ${selectedUser?._id === user._id ? "bg-base-300" : "hover:bg-base-200"}
            `}
          >
            <div className="relative mx-auto md:mx-0">
              <img
                src={user.profilePic || "/avatar.png"}
                alt={user.name}
                className="size-12 object-cover rounded-full"
              />
              {onlineUsers.includes(user._id) && (
                <span
                  className="absolute bottom-0 right-0 size-3 bg-green-500 
                  rounded-full ring-2 ring-base-100"
                />
              )}
            </div>

            {/* User info - only visible on larger screens */}
            <div className="flex flex-col text-left min-w-0 flex-1">
              <div className="flex justify-between items-center w-full">
                <div className="font-medium truncate text-base-content">{user.fullName}</div>
              </div>
              <div className={`text-sm truncate ${selectedUser?._id === user._id ? "text-base-content/80" : "text-base-content/70"}`}>
                {onlineUsers.includes(user._id) ? "online" : "offline"}
              </div>
            </div>
          </button>
        ))}

        {filteredUsers.length === 0 && (
          <div className="text-center text-base-content/70 py-4 px-4">
            No friends yet. Send a friend request by email to start chatting.
          </div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
