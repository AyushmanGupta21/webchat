import { useChatStore } from "@/store/useChatStore";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { X } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "@/store/useAuthStore";
import { formatMessageTime } from "@/lib/utils";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [mediaViewer, setMediaViewer] = useState(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getMediaDownloadFileName = (message) => {
    if (message.imageFileName) return message.imageFileName;
    if (message.imageMimeType?.startsWith("image/") || message.imageMimeType?.startsWith("video/")) {
      const extension = message.imageMimeType.split("/")[1] || "bin";
      return `chat-media-${message._id}.${extension}`;
    }

    return `chat-media-${message._id}.bin`;
  };

  const openMediaViewer = (message) => {
    if (!message.image || message.imageEncrypted) return;

    setMediaViewer({
      url: message.image,
      mimeType: message.imageMimeType || "image/*",
      fileName: getMediaDownloadFileName(message),
    });
  };

  const closeMediaViewer = () => {
    setMediaViewer(null);
  };

  const triggerDownload = (url, fileName) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadAttachment = async (message) => {
    try {
      if (message.imageEncrypted) {
        toast.error("This is legacy encrypted media. Passphrase mode is currently disabled.");
        return;
      }

      const response = await fetch(message.image);
      if (!response.ok) {
        throw new Error("Unable to download attachment from cloud");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      try {
        triggerDownload(objectUrl, getMediaDownloadFileName(message));
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch (error) {
      toast.error("Failed to save media. Try again.");
    }
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ChatHeader />

      {/* Main chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const hasRenderableMedia = Boolean(message.image) && !message.imageEncrypted;
          const isVideoAttachment = Boolean(message.imageMimeType?.startsWith("video/"));
          const hasRenderableText = Boolean(message.text && message.text.trim());
          const isSentByMe = message.senderId === authUser._id;

          // Hide legacy encrypted-only messages while passphrase mode is disabled.
          if (!hasRenderableMedia && !hasRenderableText) {
            return null;
          }

          return (
            <div
              key={message._id}
              className={`chat ${isSentByMe ? "chat-end" : "chat-start"}`}
              ref={messageEndRef}
            >
              <div className="chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      isSentByMe
                        ? authUser.profilePic || "/avatar.png"
                        : selectedUser.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>

              <div className="chat-header mb-1">
                <time className="text-xs opacity-50 ml-1">{formatMessageTime(message.createdAt)}</time>
              </div>

              <div className="chat-bubble flex flex-col">
                {hasRenderableMedia && isVideoAttachment && (
                  <button type="button" onClick={() => openMediaViewer(message)}>
                    <video
                      src={message.image}
                      preload="metadata"
                      className="sm:max-w-[260px] rounded-lg mb-1 cursor-zoom-in"
                    />
                  </button>
                )}
                {hasRenderableMedia && !isVideoAttachment && (
                  <>
                    <button type="button" onClick={() => openMediaViewer(message)}>
                      <img
                        src={message.image}
                        alt="Attachment"
                        className="sm:max-w-[260px] rounded-lg mb-1 cursor-zoom-in"
                      />
                    </button>
                  </>
                )}
                {hasRenderableMedia && (
                  <button
                    type="button"
                    onClick={() => downloadAttachment(message)}
                    className="text-xs underline text-left opacity-80 hover:opacity-100 mb-1"
                  >
                    Save media
                  </button>
                )}
                {hasRenderableText && <p className="text-[15px] leading-relaxed break-words">{message.text}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {mediaViewer && (
        <div
          className="fixed inset-0 z-50 bg-black/85 p-4 flex items-center justify-center"
          onClick={closeMediaViewer}
        >
          <div className="w-full max-w-5xl flex flex-col items-end gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => triggerDownload(mediaViewer.url, mediaViewer.fileName)}
              >
                Save media
              </button>
              <button type="button" className="btn btn-sm btn-circle" onClick={closeMediaViewer}>
                <X className="size-4" />
              </button>
            </div>

            <div className="w-full flex justify-center">
              {mediaViewer.mimeType.startsWith("video/") ? (
                <video
                  src={mediaViewer.url}
                  controls
                  autoPlay
                  className="max-h-[85vh] w-auto rounded-lg"
                />
              ) : (
                <img
                  src={mediaViewer.url}
                  alt="Expanded attachment"
                  className="max-h-[85vh] w-auto rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
