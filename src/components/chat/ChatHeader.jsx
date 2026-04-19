import { Phone, Video, X } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { useCallStore } from "@/store/useCallStore";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, callPhase, peerUser } = useCallStore();

  const isPeerOnline = onlineUsers.includes(selectedUser._id);
  const isInAnotherCall = callPhase !== "idle" && peerUser?._id && peerUser._id !== selectedUser._id;
  const callsDisabled = !isPeerOnline || isInAnotherCall;

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

        <div className="flex items-center gap-1">
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

          <button onClick={() => setSelectedUser(null)} className="btn btn-ghost btn-sm btn-circle">
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
export default ChatHeader;
