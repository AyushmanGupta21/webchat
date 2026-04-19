import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
} from "lucide-react";
import { useCallStore } from "@/store/useCallStore";

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const CallOverlay = () => {
  const {
    callPhase,
    callType,
    peerUser,
    localStream,
    remoteStream,
    isMicrophoneMuted,
    isCameraEnabled,
    callStartedAt,
    acceptIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const isVisible = callPhase !== "idle";
  const isIncoming = callPhase === "incoming";
  const isActiveCall = callPhase === "active" || callPhase === "connecting" || callPhase === "outgoing";
  const isVideoCall = callType === "video";

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = localStream || null;
  }, [localStream]);

  useEffect(() => {
    if (!remoteVideoRef.current) return;
    remoteVideoRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  useEffect(() => {
    if (!remoteAudioRef.current) return;
    remoteAudioRef.current.srcObject = remoteStream || null;
  }, [remoteStream]);

  useEffect(() => {
    if (!callStartedAt) {
      setElapsedMs(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedMs(Date.now() - callStartedAt);
    }, 1000);

    return () => clearInterval(timer);
  }, [callStartedAt]);

  if (!isVisible || !peerUser?._id) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none p-4 flex items-end sm:items-center justify-center">
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-base-300 bg-base-100 shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-base-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={peerUser.profilePic || "/avatar.png"}
              alt={peerUser.fullName}
              className="size-10 rounded-full border border-base-300 object-cover"
            />
            <div className="min-w-0">
              <p className="font-semibold truncate">{peerUser.fullName}</p>
              <p className="text-xs text-base-content/70 capitalize">
                {isIncoming
                  ? `Incoming ${callType || "voice"} call`
                  : callPhase === "outgoing"
                    ? `Calling... (${callType || "voice"})`
                    : callPhase === "connecting"
                      ? "Connecting..."
                      : `In call • ${formatDuration(elapsedMs)}`}
              </p>
            </div>
          </div>

          {!isIncoming && (
            <button type="button" className="btn btn-sm btn-error text-white" onClick={endCall}>
              <PhoneOff className="size-4" />
              End
            </button>
          )}
        </div>

        <div className="p-4 bg-base-200/40">
          {isVideoCall ? (
            <div className="relative rounded-xl overflow-hidden border border-base-300 bg-black/90 h-[360px] sm:h-[420px]">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />

              <div className="absolute bottom-3 right-3 w-28 h-20 sm:w-40 sm:h-28 rounded-lg border border-base-300 overflow-hidden bg-black">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-base-300 bg-base-100 p-8 sm:p-12 flex flex-col items-center text-center gap-4">
              <div className="avatar">
                <div className="size-20 rounded-full border border-base-300">
                  <img src={peerUser.profilePic || "/avatar.png"} alt={peerUser.fullName} />
                </div>
              </div>
              <p className="text-base-content/80">
                {callPhase === "outgoing"
                  ? "Ringing..."
                  : callPhase === "connecting"
                    ? "Establishing secure connection..."
                    : "Voice call in progress"}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-base-300 flex items-center justify-center gap-3 flex-wrap">
          {isIncoming ? (
            <>
              <button
                type="button"
                className="btn btn-success text-white"
                onClick={acceptIncomingCall}
              >
                {isVideoCall ? <Video className="size-4" /> : <Phone className="size-4" />}
                Accept
              </button>
              <button type="button" className="btn btn-error text-white" onClick={rejectIncomingCall}>
                <PhoneOff className="size-4" />
                Decline
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={toggleMicrophone}>
                {isMicrophoneMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                {isMicrophoneMuted ? "Unmute" : "Mute"}
              </button>

              {isVideoCall && (
                <button type="button" className="btn btn-ghost" onClick={toggleCamera}>
                  {isCameraEnabled ? <Camera className="size-4" /> : <CameraOff className="size-4" />}
                  {isCameraEnabled ? "Camera On" : "Camera Off"}
                </button>
              )}

              {isActiveCall && (
                <button type="button" className="btn btn-error text-white" onClick={endCall}>
                  <PhoneOff className="size-4" />
                  Hang Up
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;