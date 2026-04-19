import { useEffect, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Calendar, Menu, Search, User, Settings, LogOut, Bookmark, Phone, Users, Bell } from "lucide-react";
import Link from "next/link";
import { useThemeStore } from "@/store/useThemeStore";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    searchMessages,
    setFocusedMessage,
  } = useChatStore();
  const { onlineUsers, authUser, logout } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchThisChat, setSearchThisChat] = useState(false);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    const hasSearch = Boolean(searchTerm.trim() || searchDate);
    if (!hasSearch) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);

      const results = await searchMessages({
        query: searchTerm,
        date: searchDate,
        userId: searchThisChat ? selectedUser?._id : "",
      });

      if (!cancelled) {
        setSearchResults(results);
        setIsSearching(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchDate, searchMessages, searchTerm, searchThisChat, selectedUser?._id]);

  const filteredUsers = users;

  const jumpToSearchResult = (result) => {
    const matchedUser = users.find((user) => user._id === result.chatUserId) || {
      _id: result.chatUserId,
      fullName: result.chatUserFullName,
      profilePic: result.chatUserProfilePic,
    };

    setSelectedUser(matchedUser);
    setFocusedMessage(result._id);
    setSearchTerm("");
    setSearchDate("");
    setSearchResults([]);
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full md:w-[320px] lg:w-[400px] flex flex-col transition-all duration-200 bg-base-100 border-r border-base-300 relative">
      {/* Header section (Hamburgers + Search) */}
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
            placeholder="Search messages"
            className="w-full bg-base-200 text-base-content placeholder-base-content/70 border-none rounded-full py-1.5 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm transition-all"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>

        <label className="btn btn-ghost btn-circle btn-sm" title="Search by date">
          <Calendar className="size-4" />
          <input
            type="date"
            className="hidden"
            value={searchDate}
            onChange={(event) => setSearchDate(event.target.value)}
          />
        </label>
      </div>

      {(searchTerm || searchDate || isSearching) && (
        <div className="px-3 pb-2">
          <label className="label cursor-pointer py-1 px-1">
            <span className="label-text text-xs">Search only in selected chat</span>
            <input
              type="checkbox"
              className="checkbox checkbox-xs"
              checked={searchThisChat}
              onChange={(event) => setSearchThisChat(event.target.checked)}
              disabled={!selectedUser}
            />
          </label>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-base-300 bg-base-100">
            {isSearching && (
              <div className="p-3 text-sm text-base-content/70">Searching messages...</div>
            )}

            {!isSearching && searchResults.length === 0 && (
              <div className="p-3 text-sm text-base-content/70">No matching messages found.</div>
            )}

            {!isSearching &&
              searchResults.map((result) => (
                <button
                  key={`${result._id}-${result.chatUserId}`}
                  type="button"
                  className="w-full border-b border-base-300 last:border-b-0 px-3 py-2 text-left hover:bg-base-200"
                  onClick={() => jumpToSearchResult(result)}
                >
                  <div className="text-xs text-base-content/60">{result.chatUserFullName}</div>
                  <div className="truncate text-sm">
                    {result.text || (result.image ? "Media message" : "Message")}
                  </div>
                  <div className="text-[11px] text-base-content/60">
                    {new Date(result.createdAt).toLocaleString()}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

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
          <div className="text-center text-base-content/70 py-4">No online users</div>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;
