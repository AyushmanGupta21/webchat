import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, MoreVertical, Phone, Video, X } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { useCallStore } from "@/store/useCallStore";
import ChatWallpaperModal from "./ChatWallpaperModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callPhase, peerUser } = useCallStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const menuRef = useRef(null);

  const isPeerOnline = onlineUsers.includes(selectedUser._id);
  const isInAnotherCall = callPhase !== "idle" && peerUser?._id && peerUser._id !== selectedUser._id;
  const callsDisabled = !isPeerOnline || isInAnotherCall;

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>

          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1" ref={menuRef}>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => startCall(selectedUser, "voice")}
            disabled={callsDisabled}
            title={isPeerOnline ? "Start voice call" : "User is offline"}
          >
            <Phone className="size-5" />
          </button>

          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => startCall(selectedUser, "video")}
            disabled={callsDisabled}
            title={isPeerOnline ? "Start video call" : "User is offline"}
          >
            <Video className="size-5" />
          </button>

          <div className="relative">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-circle"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Chat options"
            >
              <MoreVertical className="size-5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.25rem)] z-20 w-44 rounded-xl border border-base-300 bg-base-100 p-1 shadow-xl">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm w-full justify-start"
                  onClick={() => {
                    setIsWallpaperModalOpen(true);
                    setIsMenuOpen(false);
                  }}
                >
                  <ImageIcon className="size-4" />
                  Set wallpaper
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-sm btn-circle">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <ChatWallpaperModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
      />
    </div>
  );
};
export default ChatHeader;
