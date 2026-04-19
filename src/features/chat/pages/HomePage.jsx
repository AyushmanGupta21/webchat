import { useChatStore } from "@/store/useChatStore";

import Sidebar from "@/components/chat/Sidebar";
import NoChatSelected from "@/components/chat/NoChatSelected";
import ChatContainer from "@/components/chat/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-screen w-full bg-base-100 text-base-content flex overflow-hidden">
      <div className={`${selectedUser ? "hidden md:flex" : "flex"} h-full w-full md:w-auto`}>
        <Sidebar />
      </div>
      <div className={`${selectedUser ? "flex" : "hidden md:flex"} h-full flex-1`}>
        {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
      </div>
    </div>
  );
};
export default HomePage;
