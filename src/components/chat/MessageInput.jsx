import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { Paperclip, Search, Send, Smile, X } from "lucide-react";
import EmojiPicker, { EmojiStyle } from "emoji-picker-react";
import toast from "react-hot-toast";

const TENOR_API_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY || "LIVDSRZULELA";
const TENOR_CLIENT_KEY = process.env.NEXT_PUBLIC_TENOR_CLIENT_KEY || "webchat";

const STICKER_TYPES = [
  { label: "Cute", query: "cute sticker" },
  { label: "Meme", query: "meme sticker" },
  { label: "Anime", query: "anime sticker" },
  { label: "Love", query: "love sticker" },
  { label: "Reaction", query: "reaction sticker" },
];

const pickFormat = (formats, keys) => {
  for (const key of keys) {
    if (formats?.[key]?.url) return formats[key];
  }

  return null;
};

const normalizeGifResults = (results) => {
  const cleaned = results.filter(
    (item) => !item.aspectRatio || (item.aspectRatio >= 0.6 && item.aspectRatio <= 2)
  );

  // Keep all results if aggressive filtering removes too many items.
  return cleaned.length >= 10 ? cleaned : results;
};

const FALLBACK_GIFS = [
  {
    id: "fallback-gif-1",
    previewUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Q4empkMGV4N2Q3M3JqeGQ5b2M5bnl2c3l2N2xva2Q0bXd6ZXN3biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ICOgUNjpvO0PC/giphy.gif",
    sendUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3Q4empkMGV4N2Q3M3JqeGQ5b2M5bnl2c3l2N2xva2Q0bXd6ZXN3biZlcD12MV9naWZzX3NlYXJjaCZjdD1n/ICOgUNjpvO0PC/giphy.gif",
    mimeType: "image/gif",
    fileName: "laugh.gif",
  },
  {
    id: "fallback-gif-2",
    previewUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3Q5eHg5N3JxczgwNnN6c2xjN3NwN2R6a3F4eHZlaTR1ZjI3eDJsYiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6Zt481isNVuQI1l6/giphy.gif",
    sendUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3Q5eHg5N3JxczgwNnN6c2xjN3NwN2R6a3F4eHZlaTR1ZjI3eDJsYiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3o6Zt481isNVuQI1l6/giphy.gif",
    mimeType: "image/gif",
    fileName: "clap.gif",
  },
  {
    id: "fallback-gif-3",
    previewUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9vZ3Q3eXJ4YjltZ2M3Zm9xY3M1YWdtNnZ5cXZ6dDVlbmRwZ3A2YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/111ebonMs90YLu/giphy.gif",
    sendUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm9vZ3Q3eXJ4YjltZ2M3Zm9xY3M1YWdtNnZ5cXZ6dDVlbmRwZ3A2YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/111ebonMs90YLu/giphy.gif",
    mimeType: "image/gif",
    fileName: "cat-wave.gif",
  },
  {
    id: "fallback-gif-4",
    previewUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTc5eTF4YnZ4bWh6NTN1aXlrZHl0Nnhtc3B2eWt5dHJzY3p3M2hnaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0MYt5jPR6QX5pnqM/giphy.gif",
    sendUrl: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeTc5eTF4YnZ4bWh6NTN1aXlrZHl0Nnhtc3B2eWt5dHJzY3p3M2hnaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/l0MYt5jPR6QX5pnqM/giphy.gif",
    mimeType: "image/gif",
    fileName: "thumbs-up.gif",
  },
];

const FALLBACK_STICKERS = [
  {
    id: "fallback-sticker-1",
    previewUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f60e.png",
    sendUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f60e.png",
    mimeType: "image/png",
    fileName: "cool-sticker.png",
  },
  {
    id: "fallback-sticker-2",
    previewUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f389.png",
    sendUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f389.png",
    mimeType: "image/png",
    fileName: "party-sticker.png",
  },
  {
    id: "fallback-sticker-3",
    previewUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f44d.png",
    sendUrl: "https://twemoji.maxcdn.com/v/latest/72x72/1f44d.png",
    mimeType: "image/png",
    fileName: "thumbs-up-sticker.png",
  },
  {
    id: "fallback-sticker-4",
    previewUrl: "https://twemoji.maxcdn.com/v/latest/72x72/2764.png",
    sendUrl: "https://twemoji.maxcdn.com/v/latest/72x72/2764.png",
    mimeType: "image/png",
    fileName: "heart-sticker.png",
  },
];

const inferMimeType = (url) => {
  if (!url) return "image/gif";
  if (url.includes(".mp4")) return "video/mp4";
  if (url.includes(".webm")) return "video/webm";
  if (url.includes(".webp")) return "image/webp";
  if (url.includes(".png")) return "image/png";
  return "image/gif";
};

const buildFileName = (title, mimeType) => {
  const baseName = (title || "media")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);

  if (mimeType.includes("mp4")) return `${baseName || "media"}.mp4`;
  if (mimeType.includes("webm")) return `${baseName || "media"}.webm`;
  if (mimeType.includes("webp")) return `${baseName || "media"}.webp`;
  if (mimeType.includes("png")) return `${baseName || "media"}.png`;
  return `${baseName || "media"}.gif`;
};

const parseTenorV2Result = (item) => {
  const formats = item?.media_formats || {};

  const previewFormat = pickFormat(formats, [
    "gif",
    "mediumgif",
    "webp",
    "tinygif",
    "tinywebp",
    "mp4",
    "nanogif",
  ]);

  const sendFormat =
    pickFormat(formats, ["gif", "mediumgif", "tinygif", "webp", "tinywebp", "mp4"]) ||
    previewFormat;

  const previewUrl = previewFormat?.url;
  const sendUrl = sendFormat?.url;

  if (!previewUrl || !sendUrl) return null;

  const mimeType = inferMimeType(sendUrl);
  const dims = previewFormat?.dims || sendFormat?.dims || [];
  const aspectRatio = dims[0] && dims[1] ? dims[0] / dims[1] : null;

  return {
    id: item?.id || sendUrl,
    previewUrl,
    sendUrl,
    mimeType,
    aspectRatio,
    fileName: buildFileName(item?.content_description || item?.title, mimeType),
  };
};

const parseTenorV1Result = (item) => {
  const media = item?.media?.[0] || {};

  const previewFormat = pickFormat(media, [
    "gif",
    "mediumgif",
    "webp",
    "tinygif",
    "nanogif",
    "mp4",
  ]);

  const sendFormat = pickFormat(media, ["gif", "mediumgif", "tinygif", "webp", "mp4"]) || previewFormat;

  const previewUrl = previewFormat?.url;
  const sendUrl = sendFormat?.url;

  if (!previewUrl || !sendUrl) return null;

  const mimeType = inferMimeType(sendUrl);
  const dims = previewFormat?.dims || sendFormat?.dims || [];
  const aspectRatio = dims[0] && dims[1] ? dims[0] / dims[1] : null;

  return {
    id: item?.id || sendUrl,
    previewUrl,
    sendUrl,
    mimeType,
    aspectRatio,
    fileName: buildFileName(item?.content_description || item?.title, mimeType),
  };
};

const fetchTenorMedia = async ({ query, mode }) => {
  const trimmedQuery = query.trim();
  const isStickerMode = mode === "sticker";
  const resolvedQuery = trimmedQuery || (isStickerMode ? "sticker" : "");

  try {
    const v2Params = new URLSearchParams({
      key: TENOR_API_KEY,
      client_key: TENOR_CLIENT_KEY,
      limit: "24",
      media_filter: "gif,mediumgif,webp,tinygif,mp4",
      locale: "en_US",
      contentfilter: "medium",
    });

    if (isStickerMode) {
      v2Params.set("searchfilter", "sticker,-static");
    }

    const v2Endpoint = mode === "gif" && !trimmedQuery ? "featured" : "search";
    if (v2Endpoint === "search") {
      v2Params.set("q", resolvedQuery || "trending");
    }

    const v2Response = await fetch(`https://tenor.googleapis.com/v2/${v2Endpoint}?${v2Params.toString()}`);
    if (!v2Response.ok) {
      throw new Error(`Tenor v2 request failed (${v2Response.status})`);
    }

    const v2Payload = await v2Response.json();
    const v2RawResults = (v2Payload?.results || []).map(parseTenorV2Result).filter(Boolean);
    const v2Results = isStickerMode ? v2RawResults : normalizeGifResults(v2RawResults);
    if (v2Results.length > 0) {
      return v2Results;
    }

    throw new Error("Tenor v2 returned no results");
  } catch {
    try {
      const v1Params = new URLSearchParams({
        key: TENOR_API_KEY,
        limit: "24",
        media_filter: "basic",
        contentfilter: "medium",
      });

      if (isStickerMode) {
        v1Params.set("searchfilter", "sticker");
      }

      const v1Endpoint = mode === "gif" && !trimmedQuery ? "trending" : "search";
      if (v1Endpoint === "search") {
        v1Params.set("q", resolvedQuery || "funny");
      }

      const v1Response = await fetch(`https://g.tenor.com/v1/${v1Endpoint}?${v1Params.toString()}`);
      if (!v1Response.ok) {
        throw new Error(`Tenor v1 request failed (${v1Response.status})`);
      }

      const v1Payload = await v1Response.json();
      const v1RawResults = (v1Payload?.results || []).map(parseTenorV1Result).filter(Boolean);
      const v1Results = isStickerMode ? v1RawResults : normalizeGifResults(v1RawResults);
      if (v1Results.length > 0) {
        return v1Results;
      }

      return isStickerMode ? FALLBACK_STICKERS : FALLBACK_GIFS;
    } catch {
      return isStickerMode ? FALLBACK_STICKERS : FALLBACK_GIFS;
    }
  }
};

const MessageInput = () => {
  const [text, setText] = useState("");
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaFile, setMediaFile] = useState(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("emoji");
  const [mediaSearch, setMediaSearch] = useState("");
  const [mediaResults, setMediaResults] = useState([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState("");
  const [activeStickerType, setActiveStickerType] = useState(STICKER_TYPES[0]);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);
  const pickerToggleRef = useRef(null);
  const { sendMessage } = useChatStore();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        if (!pickerToggleRef.current || !pickerToggleRef.current.contains(event.target)) {
          setIsPickerOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isPickerOpen || pickerTab === "emoji") return;

    let cancelled = false;

    const loadMedia = async () => {
      setIsMediaLoading(true);
      setMediaError("");

      try {
        const query =
          pickerTab === "sticker"
            ? mediaSearch.trim() || activeStickerType.query
            : mediaSearch.trim();

        const results = await fetchTenorMedia({ query, mode: pickerTab });

        if (!cancelled) {
          setMediaResults(results);
        }
      } catch (error) {
        if (!cancelled) {
          setMediaResults([]);
          setMediaError("Could not load media right now. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setIsMediaLoading(false);
        }
      }
    };

    const debounceTimer = setTimeout(loadMedia, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
    };
  }, [isPickerOpen, pickerTab, mediaSearch, activeStickerType]);

  const revokeObjectUrl = (url) => {
    if (url?.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Could not read selected media"));
          return;
        }

        resolve(reader.result);
      };
      reader.onerror = () => reject(new Error("Could not read selected media"));
      reader.readAsDataURL(file);
    });

  const clearComposer = () => {
    setText("");
    setMediaFile(null);
    setMediaPreview((previousPreview) => {
      revokeObjectUrl(previousPreview);
      return null;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleMediaChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      toast.error("Please select an image or video file");
      return;
    }

    if (file.size > 30 * 1024 * 1024) {
      toast.error("Media must be 30MB or smaller");
      return;
    }

    setMediaFile(file);
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview((previousPreview) => {
      revokeObjectUrl(previousPreview);
      return objectUrl;
    });
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview((previousPreview) => {
      revokeObjectUrl(previousPreview);
      return null;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !mediaFile) return;

    try {
      let imagePayload;
      let mediaMeta;

      if (mediaFile) {
        imagePayload = await fileToDataUrl(mediaFile);
        mediaMeta = {
          mimeType: mediaFile.type || null,
          fileName: mediaFile.name || null,
        };
      }

      await sendMessage({
        text: text.trim(),
        image: imagePayload,
        mediaMeta,
      });

      clearComposer();
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Unable to send media. Try again.");
    }
  };

  const insertEmoji = (emoji) => {
    setText((prev) => `${prev}${emoji}`);
  };

  const onEmojiClick = (emojiData) => {
    insertEmoji(emojiData.emoji);
  };

  const selectPickerTab = (tabName) => {
    setPickerTab(tabName);
    setMediaSearch("");
    setMediaResults([]);
    setMediaError("");
  };

  const sendPresetMedia = async (url, fileName, mimeType) => {
    try {
      await sendMessage({
        text: text.trim(),
        image: url,
        mediaMeta: {
          mimeType,
          fileName,
        },
      });

      clearComposer();
      setIsPickerOpen(false);
    } catch (error) {
      console.error("Failed to send preset media:", error);
      toast.error("Unable to send media. Try again.");
    }
  };

  return (
    <div className="p-4 w-full relative">
      {isPickerOpen && (
        <div
          ref={pickerRef}
          className="absolute bottom-[calc(100%+0.75rem)] left-0 right-0 sm:left-auto z-40 h-[500px] sm:w-[430px] rounded-2xl border border-base-300 bg-base-100 shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="px-3 pt-3 pb-2 border-b border-base-300">
            <div className="tabs tabs-boxed w-fit">
              <button
                type="button"
                className={`tab ${pickerTab === "emoji" ? "tab-active" : ""}`}
                onClick={() => selectPickerTab("emoji")}
              >
                Emoji
              </button>
              <button
                type="button"
                className={`tab ${pickerTab === "gif" ? "tab-active" : ""}`}
                onClick={() => selectPickerTab("gif")}
              >
                GIF
              </button>
              <button
                type="button"
                className={`tab ${pickerTab === "sticker" ? "tab-active" : ""}`}
                onClick={() => selectPickerTab("sticker")}
              >
                Sticker
              </button>
            </div>
          </div>

          {pickerTab === "emoji" && (
            <div className="flex-1 min-h-0 p-2">
              <div className="h-full rounded-xl overflow-hidden border border-base-300">
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  width="100%"
                  height="100%"
                  previewConfig={{ showPreview: false }}
                  searchPlaceHolder="Search emoji"
                  skinTonesDisabled={false}
                  emojiStyle={EmojiStyle.APPLE}
                  emojiVersion="15.1"
                  suggestedEmojisMode="recent"
                  searchDisabled={false}
                  lazyLoadEmojis
                  theme="auto"
                />
              </div>
            </div>
          )}

          {(pickerTab === "gif" || pickerTab === "sticker") && (
            <div className="flex-1 min-h-0 p-3 flex flex-col">
              <label className="input input-bordered input-sm flex items-center gap-2 mb-2">
                <Search className="size-4 text-base-content/60" />
                <input
                  type="text"
                  className="grow"
                  placeholder={pickerTab === "gif" ? "Search GIFs" : "Search stickers"}
                  value={mediaSearch}
                  onChange={(event) => setMediaSearch(event.target.value)}
                />
              </label>

              {pickerTab === "sticker" && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {STICKER_TYPES.map((type) => (
                    <button
                      key={type.label}
                      type="button"
                      className={`btn btn-xs ${activeStickerType.label === type.label ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setActiveStickerType(type)}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              )}

              {isMediaLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}

              {!isMediaLoading && mediaError && (
                <div className="flex-1 flex items-center justify-center text-sm text-error">{mediaError}</div>
              )}

              {!isMediaLoading && !mediaError && mediaResults.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-sm text-base-content/70">
                  No results found.
                </div>
              )}

              {!isMediaLoading && !mediaError && mediaResults.length > 0 && pickerTab === "gif" && (
                <div className="grid grid-cols-2 gap-2 overflow-y-auto flex-1 pr-1">
                  {mediaResults.map((media) => (
                    <button
                      key={media.id}
                      type="button"
                      onClick={() => sendPresetMedia(media.sendUrl, media.fileName, media.mimeType)}
                      className="rounded-xl overflow-hidden border border-base-300 bg-base-200 hover:opacity-90 transition h-32"
                      title={media.fileName}
                    >
                      {media.mimeType.startsWith("video/") ? (
                        <video
                          src={media.previewUrl}
                          className="w-full h-full object-contain bg-base-300/30"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <img src={media.previewUrl} alt={media.fileName} className="w-full h-full object-contain bg-base-300/30" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!isMediaLoading && !mediaError && mediaResults.length > 0 && pickerTab === "sticker" && (
                <div className="grid grid-cols-4 gap-2 overflow-y-auto flex-1 pr-1">
                  {mediaResults.map((media) => (
                    <button
                      key={media.id}
                      type="button"
                      onClick={() => sendPresetMedia(media.sendUrl, media.fileName, media.mimeType)}
                      className="rounded-lg overflow-hidden border border-base-300 bg-base-200 hover:bg-base-300 transition p-1 aspect-square"
                      title={media.fileName}
                    >
                      {media.mimeType.startsWith("video/") ? (
                        <video
                          src={media.previewUrl}
                          className="w-full h-full object-contain"
                          muted
                          loop
                          autoPlay
                          playsInline
                        />
                      ) : (
                        <img src={media.previewUrl} alt={media.fileName} className="w-full h-full object-contain" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mediaPreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {mediaFile?.type?.startsWith("video/") ? (
              <video
                src={mediaPreview}
                controls
                className="w-28 h-20 object-cover rounded-lg border border-base-300"
              />
            ) : (
              <img
                src={mediaPreview}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-base-300"
              />
            )}
            <button
              onClick={removeMedia}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 text-base-content
              flex items-center justify-center shadow-lg"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleMediaChange}
          />
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-circle"
            ref={pickerToggleRef}
            onClick={() => {
              setPickerTab((prev) => prev || "emoji");
              setIsPickerOpen((prev) => !prev);
            }}
            title="Emoji, GIF and Sticker"
          >
            <Smile className="size-5" />
          </button>

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle ${mediaPreview ? "text-primary" : "text-base-content/60"}`}
            onClick={() => fileInputRef.current?.click()}
            title="Attach media"
          >
            <Paperclip className="size-5" />
          </button>
        </div>

        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !mediaFile}
        >
          <Send className="size-5" />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
