import { useChatStore } from "@/store/useChatStore";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CornerUpLeft, Copy, Pencil, Trash2, X } from "lucide-react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "@/store/useAuthStore";
import { formatMessageTime } from "@/lib/utils";

const QUICK_REACTIONS = ["❤️", "👍", "😂", "🔥", "😮", "😢"];

const groupReactions = (reactions = [], currentUserId) => {
  const grouped = new Map();

  reactions.forEach((reaction) => {
    if (!reaction?.emoji) return;

    if (!grouped.has(reaction.emoji)) {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 0,
        reactedByMe: false,
      });
    }

    const next = grouped.get(reaction.emoji);
    next.count += 1;
    if (reaction.userId === currentUserId) {
      next.reactedByMe = true;
    }
  });

  return Array.from(grouped.values());
};

const getMessagePreview = (message) => {
  if (!message) return "Message";
  if (message.text) return message.text;
  if (message.image) return "Media attachment";
  return "Message";
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    toggleReaction,
    deleteMessage,
    setReplyToMessage,
    beginEditMessage,
    focusedMessageId,
    setFocusedMessage,
    getChatWallpaper,
    chatWallpaper,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const messageRefs = useRef({});
  const longPressTimeoutRef = useRef(null);
  const highlightTimeoutRef = useRef(null);
  const [mediaViewer, setMediaViewer] = useState(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    message: null,
  });
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    message: null,
    deleteForEveryone: false,
  });

  useEffect(() => {
    getMessages(selectedUser._id);
    getChatWallpaper(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [
    selectedUser._id,
    getMessages,
    getChatWallpaper,
    subscribeToMessages,
    unsubscribeFromMessages,
  ]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!focusedMessageId) return;

    const targetNode = messageRefs.current[focusedMessageId];
    if (!targetNode) return;

    targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedMessageId(focusedMessageId);
    setFocusedMessage(null);

    clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
    }, 2400);
  }, [focusedMessageId, messages, setFocusedMessage]);

  useEffect(() => {
    const closeMenu = () => {
      setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));
    };

    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(longPressTimeoutRef.current);
      clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

  const clearLongPressTimer = () => {
    if (!longPressTimeoutRef.current) return;
    clearTimeout(longPressTimeoutRef.current);
    longPressTimeoutRef.current = null;
  };

  const openMessageActions = (message, x, y) => {
    const safeX = Math.max(12, Math.min(window.innerWidth - 240, x));
    const safeY = Math.max(12, Math.min(window.innerHeight - 220, y));

    setContextMenu({
      isOpen: true,
      x: safeX,
      y: safeY,
      message,
    });
  };

  const onMessageContextMenu = (event, message) => {
    event.preventDefault();
    openMessageActions(message, event.clientX, event.clientY);
  };

  const onMessageTouchStart = (event, message) => {
    clearLongPressTimer();
    const touch = event.touches?.[0];
    if (!touch) return;

    longPressTimeoutRef.current = setTimeout(() => {
      openMessageActions(message, touch.clientX, touch.clientY);
    }, 420);
  };

  const onMessageTouchEnd = () => {
    clearLongPressTimer();
  };

  const applyReaction = async (message, emoji) => {
    try {
      await toggleReaction(message._id, emoji);
    } catch (error) {
      toast.error(error?.message || "Could not react to message");
    }
  };

  const askDeleteMessage = (message) => {
    setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));

    const isMyMessage = message.senderId === authUser._id;
    setDeleteDialog({
      isOpen: true,
      message,
      deleteForEveryone: isMyMessage,
    });
  };

  const confirmDeleteMessage = async () => {
    if (!deleteDialog.message) return;

    try {
      await deleteMessage(
        deleteDialog.message._id,
        deleteDialog.deleteForEveryone ? "everyone" : "me"
      );
      toast.success("Message deleted");
      setDeleteDialog({ isOpen: false, message: null, deleteForEveryone: false });
    } catch (error) {
      toast.error(error?.message || "Failed to delete message");
    }
  };

  const copyMessageText = async (messageText) => {
    try {
      await navigator.clipboard.writeText(messageText || "");
      toast.success("Copied");
    } catch {
      toast.error("Unable to copy text");
    }
  };

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

  const selectedMessageId = contextMenu.isOpen ? contextMenu.message?._id : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <ChatHeader />

      <div className="relative flex-1 overflow-hidden">
        {chatWallpaper?.wallpaperUrl && (
          <div className="pointer-events-none absolute inset-0">
            <img
              src={chatWallpaper.wallpaperUrl}
              alt="Chat wallpaper"
              className="h-full w-full object-cover"
              style={{ filter: chatWallpaper.blurEnabled ? "blur(3px)" : "none" }}
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: `rgba(0, 0, 0, ${(chatWallpaper.dimming || 0) / 100})` }}
            />
          </div>
        )}

        <div className="relative z-10 h-full overflow-y-auto p-4 space-y-4">
          {messages.map((message) => {
            const hasRenderableMedia = Boolean(message.image) && !message.imageEncrypted;
            const isVideoAttachment = Boolean(message.imageMimeType?.startsWith("video/"));
            const hasRenderableText = Boolean(message.text && message.text.trim());
            const isSentByMe = message.senderId === authUser._id;
            const reactionGroups = groupReactions(message.reactions, authUser._id);
            const isMessageHighlighted =
              highlightedMessageId === message._id || selectedMessageId === message._id;

            if (!hasRenderableMedia && !hasRenderableText) {
              return null;
            }

            return (
              <div
                key={message._id}
                className={`chat ${isSentByMe ? "chat-end" : "chat-start"}`}
                onContextMenu={(event) => onMessageContextMenu(event, message)}
                onDoubleClick={() => setReplyToMessage(message)}
                onTouchStart={(event) => onMessageTouchStart(event, message)}
                onTouchEnd={onMessageTouchEnd}
                onTouchMove={onMessageTouchEnd}
                ref={(node) => {
                  if (node) {
                    messageRefs.current[message._id] = node;
                  } else {
                    delete messageRefs.current[message._id];
                  }
                }}
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

                <div className="chat-header mb-1 flex items-center gap-1">
                  <time className="text-xs opacity-60 ml-1">{formatMessageTime(message.createdAt)}</time>
                  {message.editedAt && <span className="text-[10px] opacity-60">edited</span>}
                </div>

                <div
                  className={`chat-bubble flex flex-col ${
                    isMessageHighlighted ? "ring-2 ring-primary/80" : ""
                  }`}
                >
                  {message.replyToMessage && (
                    <button
                      type="button"
                      className="mb-2 rounded-md border-l-2 border-primary/70 bg-base-200/80 px-2 py-1 text-left"
                      onClick={() => setFocusedMessage(message.replyToMessage._id)}
                    >
                      <p className="text-[11px] font-semibold">
                        {message.replyToMessage.senderId === authUser._id ? "You" : selectedUser.fullName}
                      </p>
                      <p className="truncate text-xs opacity-80">{getMessagePreview(message.replyToMessage)}</p>
                    </button>
                  )}

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
                    <button type="button" onClick={() => openMediaViewer(message)}>
                      <img
                        src={message.image}
                        alt="Attachment"
                        className="sm:max-w-[260px] rounded-lg mb-1 cursor-zoom-in"
                      />
                    </button>
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

                  {reactionGroups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {reactionGroups.map((reaction) => (
                        <button
                          key={`${message._id}-${reaction.emoji}`}
                          type="button"
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            reaction.reactedByMe
                              ? "border-primary bg-primary/20"
                              : "border-base-content/30 bg-base-100/40"
                          }`}
                          onClick={() => applyReaction(message, reaction.emoji)}
                        >
                          {reaction.emoji} {reaction.count}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div ref={messageEndRef} />
        </div>

        {contextMenu.isOpen && contextMenu.message && (
          <div
            className="fixed z-40 w-[220px] rounded-xl border border-base-300 bg-base-100 p-2 shadow-2xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex flex-wrap gap-1 rounded-lg bg-base-200 p-2">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={`${contextMenu.message._id}-${emoji}`}
                  type="button"
                  className="rounded-md px-2 py-1 text-base hover:bg-base-300"
                  onClick={() => {
                    applyReaction(contextMenu.message, emoji);
                    setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-sm w-full justify-start"
              onClick={() => {
                setReplyToMessage(contextMenu.message);
                setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));
              }}
            >
              <CornerUpLeft className="size-4" />
              Reply
            </button>

            {contextMenu.message?.text && contextMenu.message.senderId === authUser._id && (
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => {
                  beginEditMessage(contextMenu.message);
                  setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));
                }}
              >
                <Pencil className="size-4" />
                Edit
              </button>
            )}

            {contextMenu.message?.text && (
              <button
                type="button"
                className="btn btn-ghost btn-sm w-full justify-start"
                onClick={() => {
                  copyMessageText(contextMenu.message.text);
                  setContextMenu((previous) => ({ ...previous, isOpen: false, message: null }));
                }}
              >
                <Copy className="size-4" />
                Copy text
              </button>
            )}

            <button
              type="button"
              className="btn btn-ghost btn-sm w-full justify-start text-error"
              onClick={() => askDeleteMessage(contextMenu.message)}
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {deleteDialog.isOpen && deleteDialog.message && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-5 shadow-2xl">
            <h4 className="text-lg font-semibold mb-3">Do you want to delete this message?</h4>

            {deleteDialog.message.senderId === authUser._id && (
              <label className="label cursor-pointer justify-start gap-3 mb-4">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={deleteDialog.deleteForEveryone}
                  onChange={(event) =>
                    setDeleteDialog((previous) => ({
                      ...previous,
                      deleteForEveryone: event.target.checked,
                    }))
                  }
                />
                <span className="label-text">Also delete for {selectedUser.fullName}</span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setDeleteDialog({ isOpen: false, message: null, deleteForEveryone: false })
                }
              >
                Cancel
              </button>
              <button type="button" className="btn btn-error text-white" onClick={confirmDeleteMessage}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

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
