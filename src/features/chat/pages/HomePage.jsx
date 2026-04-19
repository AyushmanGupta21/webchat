import { useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useCallStore } from "@/store/useCallStore";

import Sidebar from "@/components/chat/Sidebar";
import NoChatSelected from "@/components/chat/NoChatSelected";
import ChatContainer from "@/components/chat/ChatContainer";
import CallOverlay from "@/components/chat/CallOverlay";

const HomePage = () => {
  const { selectedUser } = useChatStore();
  const { authUser, realtimeClient } = useAuthStore();
  const authUserId = authUser?._id;

  useEffect(() => {
    if (!authUserId || !realtimeClient) return;

    useCallStore.getState().bindSignaling();

    return () => {
      useCallStore.getState().unbindSignaling();
    };
  }, [authUserId, realtimeClient]);

  return (
    <div className="h-screen w-full bg-base-100 text-base-content flex overflow-hidden">
      <div className={`${selectedUser ? "hidden md:flex" : "flex"} h-full w-full md:w-auto`}>
        <Sidebar />
      </div>
      <div className={`${selectedUser ? "flex" : "hidden md:flex"} h-full flex-1`}>
        {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
      </div>

      <CallOverlay />
    </div>
  );
};
export default HomePage;
