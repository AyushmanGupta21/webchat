import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";

async function requestCloudinaryUploadSignature() {
  const response = await fetch("/api/media/sign-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ resourceType: "image" }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || payload?.message || "Unable to prepare wallpaper upload");
  }

  return response.json();
}

async function uploadWallpaperImage(file) {
  const signaturePayload = await requestCloudinaryUploadSignature();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signaturePayload.apiKey);
  formData.append("timestamp", String(signaturePayload.timestamp));
  formData.append("signature", signaturePayload.signature);
  formData.append("folder", signaturePayload.folder);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${signaturePayload.cloudName}/${signaturePayload.resourceType}/upload`,
    {
      method: "POST",
      body: formData,
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.secure_url) {
    throw new Error(payload?.error?.message || "Wallpaper upload failed");
  }

  return payload.secure_url;
}

const ChatWallpaperModal = ({ isOpen, onClose }) => {
  const {
    selectedUser,
    chatWallpaper,
    isWallpaperSaving,
    setChatWallpaper,
  } = useChatStore();

  const [scope, setScope] = useState("personal");
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [dimming, setDimming] = useState(20);
  const [wallpaperUrl, setWallpaperUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setScope(chatWallpaper?.scope === "shared" ? "shared" : "personal");
    setBlurEnabled(Boolean(chatWallpaper?.blurEnabled));
    setDimming(Number.isFinite(chatWallpaper?.dimming) ? chatWallpaper.dimming : 20);
    setWallpaperUrl(chatWallpaper?.wallpaperUrl || "");
    setSelectedFile(null);
    setFilePreviewUrl("");
  }, [chatWallpaper, isOpen]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  if (!isOpen || !selectedUser) return null;

  const previewUrl = filePreviewUrl || wallpaperUrl;

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Wallpaper image must be 25MB or smaller.");
      return;
    }

    setSelectedFile(file);
    if (filePreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(filePreviewUrl);
    }
    setFilePreviewUrl(URL.createObjectURL(file));
  };

  const applyWallpaper = async () => {
    try {
      let resolvedUrl = wallpaperUrl.trim();

      if (selectedFile) {
        setIsUploading(true);
        resolvedUrl = await uploadWallpaperImage(selectedFile);
      }

      if (!resolvedUrl) {
        toast.error("Choose a wallpaper image first.");
        return;
      }

      await setChatWallpaper(selectedUser._id, {
        scope,
        wallpaperUrl: resolvedUrl,
        blurEnabled,
        dimming,
      });

      toast.success(scope === "shared" ? "Wallpaper set for both users" : "Wallpaper set for you");
      onClose();
    } catch (error) {
      toast.error(error?.message || "Failed to set wallpaper");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl">
        <div className="flex items-center justify-between border-b border-base-300 px-4 py-3">
          <h3 className="text-lg font-semibold">Set chat wallpaper</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-base-300 p-4 text-sm hover:bg-base-200/60">
            <ImagePlus className="size-4" />
            <span>{selectedFile ? selectedFile.name : "Choose wallpaper image"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          </label>

          {previewUrl && (
            <div className="relative overflow-hidden rounded-xl border border-base-300 bg-base-200">
              <img
                src={previewUrl}
                alt="Wallpaper preview"
                className="h-48 w-full object-cover"
                style={{ filter: blurEnabled ? "blur(3px)" : "none" }}
              />
              <div
                className="absolute inset-0"
                style={{ backgroundColor: `rgba(0, 0, 0, ${dimming / 100})` }}
              />
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-base-300 p-3">
            <div className="flex items-center justify-between text-sm">
              <span>Apply wallpaper for</span>
              <div className="join">
                <button
                  type="button"
                  className={`join-item btn btn-xs ${scope === "personal" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setScope("personal")}
                >
                  Only me
                </button>
                <button
                  type="button"
                  className={`join-item btn btn-xs ${scope === "shared" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setScope("shared")}
                >
                  Both users
                </button>
              </div>
            </div>

            <label className="label cursor-pointer">
              <span className="label-text">Blur wallpaper</span>
              <input
                type="checkbox"
                className="toggle toggle-primary toggle-sm"
                checked={blurEnabled}
                onChange={(event) => setBlurEnabled(event.target.checked)}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span>Wallpaper dimming: {dimming}%</span>
              <input
                type="range"
                min="0"
                max="80"
                value={dimming}
                className="range range-primary range-sm"
                onChange={(event) => setDimming(Number.parseInt(event.target.value, 10) || 0)}
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-base-300 px-4 py-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyWallpaper}
            disabled={isUploading || isWallpaperSaving}
          >
            {isUploading || isWallpaperSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving
              </>
            ) : (
              "Apply wallpaper"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWallpaperModal;
