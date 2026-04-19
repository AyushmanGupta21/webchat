import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "@/lib/axios";
import {
  CALL_SIGNAL_EVENT,
  CALL_SIGNAL_TYPES,
  getUserChannelName,
} from "@/lib/realtime";
import { useAuthStore } from "@/store/useAuthStore";

const ICE_SERVERS = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
    ],
  },
];

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: false,
};

const VIDEO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: "user",
  },
};

function createCallSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stopMediaStream(stream) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

async function acquireLocalStream(callType) {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support realtime calls");
  }

  return navigator.mediaDevices.getUserMedia(
    callType === "video" ? VIDEO_CONSTRAINTS : AUDIO_CONSTRAINTS
  );
}

function normalizeCallType(callType) {
  return callType === "video" ? "video" : "voice";
}

export const useCallStore = create((set, get) => ({
  callPhase: "idle",
  callType: null,
  sessionId: null,
  peerUser: null,
  incomingOffer: null,
  pendingCandidates: [],
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  isMicrophoneMuted: false,
  isCameraEnabled: true,
  callStartedAt: null,
  lastError: "",
  signalingChannelName: null,
  signalingHandler: null,

  sendSignal: async (receiverId, signalPayload) => {
    try {
      await axiosInstance.post(`/calls/signal/${receiverId}`, signalPayload);
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Failed to send call signal";
      throw new Error(message);
    }
  },

  clearCall: () => {
    const { localStream, remoteStream, peerConnection } = get();

    stopMediaStream(localStream);
    stopMediaStream(remoteStream);

    if (peerConnection) {
      try {
        peerConnection.ontrack = null;
        peerConnection.onicecandidate = null;
        peerConnection.onconnectionstatechange = null;
        peerConnection.close();
      } catch {
        // Ignore close failures during teardown.
      }
    }

    set({
      callPhase: "idle",
      callType: null,
      sessionId: null,
      peerUser: null,
      incomingOffer: null,
      pendingCandidates: [],
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      isMicrophoneMuted: false,
      isCameraEnabled: true,
      callStartedAt: null,
      lastError: "",
    });
  },

  flushPendingCandidates: async () => {
    const { peerConnection, pendingCandidates } = get();

    if (!peerConnection || !peerConnection.remoteDescription || pendingCandidates.length === 0) {
      return;
    }

    for (const candidateData of pendingCandidates) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
      } catch {
        // Ignore candidate add failures for stale candidates.
      }
    }

    set({ pendingCandidates: [] });
  },

  createPeerConnection: () => {
    const existingConnection = get().peerConnection;
    if (existingConnection) return existingConnection;

    if (typeof RTCPeerConnection === "undefined") {
      throw new Error("WebRTC is not available in this browser");
    }

    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    const initialRemoteStream = new MediaStream();

    peerConnection.ontrack = (event) => {
      set((state) => {
        const targetStream = state.remoteStream || initialRemoteStream;

        const eventStream = event.streams?.[0];
        if (eventStream) {
          eventStream.getTracks().forEach((track) => {
            const exists = targetStream.getTracks().some((existing) => existing.id === track.id);
            if (!exists) {
              targetStream.addTrack(track);
            }
          });
        } else if (event.track) {
          const exists = targetStream
            .getTracks()
            .some((existing) => existing.id === event.track.id);
          if (!exists) {
            targetStream.addTrack(event.track);
          }
        }

        return { remoteStream: targetStream };
      });
    };

    peerConnection.onicecandidate = async (event) => {
      if (!event.candidate) return;

      const { peerUser, sessionId } = get();
      if (!peerUser?._id || !sessionId) return;

      try {
        await get().sendSignal(peerUser._id, {
          type: CALL_SIGNAL_TYPES.ICE_CANDIDATE,
          sessionId,
          candidate: event.candidate,
        });
      } catch {
        // Candidate signaling failures are tolerable; ICE can recover with additional candidates.
      }
    };

    peerConnection.onconnectionstatechange = () => {
      const connectionState = peerConnection.connectionState;

      if (connectionState === "connected") {
        set((state) => ({
          callPhase: "active",
          callStartedAt: state.callStartedAt || Date.now(),
        }));
        return;
      }

      if (connectionState === "failed" || connectionState === "closed") {
        const wasInCall = get().callPhase !== "idle";
        get().clearCall();
        if (wasInCall) {
          toast.error("Call connection ended");
        }
      }
    };

    const { localStream } = get();
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });
    }

    set({
      peerConnection,
      remoteStream: initialRemoteStream,
    });

    return peerConnection;
  },

  handleIncomingSignal: async (signal) => {
    const signalType = signal?.type;

    if (signalType === CALL_SIGNAL_TYPES.OFFER) {
      const fromUser = signal?.fromUser;
      const sessionId = signal?.sessionId;

      if (!fromUser?._id || !sessionId) return;

      if (get().callPhase !== "idle") {
        try {
          await get().sendSignal(fromUser._id, {
            type: CALL_SIGNAL_TYPES.BUSY,
            sessionId,
          });
        } catch {
          // Ignore busy signal failures.
        }
        return;
      }

      set({
        callPhase: "incoming",
        callType: normalizeCallType(signal?.callType),
        sessionId,
        peerUser: fromUser,
        incomingOffer: signal?.sdp || null,
        pendingCandidates: [],
        callStartedAt: null,
        lastError: "",
      });

      return;
    }

    if (signalType === CALL_SIGNAL_TYPES.ANSWER) {
      if (signal?.sessionId !== get().sessionId) return;

      const peerConnection = get().peerConnection;
      if (!peerConnection || !signal?.sdp) return;

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await get().flushPendingCandidates();
        set({ callPhase: "active", callStartedAt: Date.now() });
      } catch {
        get().clearCall();
        toast.error("Failed to connect the call");
      }
      return;
    }

    if (signalType === CALL_SIGNAL_TYPES.ICE_CANDIDATE) {
      if (signal?.sessionId !== get().sessionId || !signal?.candidate) return;

      const peerConnection = get().peerConnection;

      if (peerConnection && peerConnection.remoteDescription) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // Ignore stale ICE candidates.
        }
      } else {
        set((state) => ({ pendingCandidates: [...state.pendingCandidates, signal.candidate] }));
      }

      return;
    }

    if (signalType === CALL_SIGNAL_TYPES.REJECT) {
      if (signal?.sessionId !== get().sessionId) return;
      get().clearCall();
      toast.error("Call declined");
      return;
    }

    if (signalType === CALL_SIGNAL_TYPES.BUSY) {
      if (signal?.sessionId !== get().sessionId) return;
      get().clearCall();
      toast.error("User is busy on another call");
      return;
    }

    if (signalType === CALL_SIGNAL_TYPES.HANGUP) {
      const sameSession = signal?.sessionId && signal.sessionId === get().sessionId;
      const incomingFromSameUser =
        get().callPhase === "incoming" &&
        get().peerUser?._id &&
        get().peerUser._id === signal?.fromUser?._id;

      if (!sameSession && !incomingFromSameUser) return;

      get().clearCall();
      toast("Call ended");
    }
  },

  bindSignaling: () => {
    const { authUser, realtimeClient } = useAuthStore.getState();
    if (!authUser || !realtimeClient) return;

    const channelName = getUserChannelName(authUser._id);

    if (get().signalingChannelName === channelName && get().signalingHandler) {
      return;
    }

    const previousChannelName = get().signalingChannelName;
    const previousHandler = get().signalingHandler;
    if (previousChannelName && previousHandler) {
      const previousChannel = realtimeClient.channel(previousChannelName);
      previousChannel?.unbind(CALL_SIGNAL_EVENT, previousHandler);
    }

    const channel = realtimeClient.channel(channelName) || realtimeClient.subscribe(channelName);

    const signalHandler = (signal) => {
      get().handleIncomingSignal(signal);
    };

    channel.bind(CALL_SIGNAL_EVENT, signalHandler);

    set({
      signalingChannelName: channelName,
      signalingHandler: signalHandler,
    });
  },

  unbindSignaling: () => {
    const { realtimeClient } = useAuthStore.getState();
    const { signalingChannelName, signalingHandler } = get();

    if (realtimeClient && signalingChannelName && signalingHandler) {
      const channel = realtimeClient.channel(signalingChannelName);
      channel?.unbind(CALL_SIGNAL_EVENT, signalingHandler);
    }

    set({
      signalingChannelName: null,
      signalingHandler: null,
    });

    get().clearCall();
  },

  startCall: async (peerUser, requestedType) => {
    if (!peerUser?._id) {
      toast.error("Select a user to start a call");
      return false;
    }

    if (get().callPhase !== "idle") {
      toast.error("You are already in a call");
      return false;
    }

    const callType = normalizeCallType(requestedType);
    const sessionId = createCallSessionId();

    try {
      const localStream = await acquireLocalStream(callType);

      set({
        callPhase: "outgoing",
        callType,
        sessionId,
        peerUser,
        incomingOffer: null,
        pendingCandidates: [],
        localStream,
        remoteStream: null,
        peerConnection: null,
        isMicrophoneMuted: false,
        isCameraEnabled: callType === "video",
        callStartedAt: null,
        lastError: "",
      });

      const peerConnection = get().createPeerConnection();
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await get().sendSignal(peerUser._id, {
        type: CALL_SIGNAL_TYPES.OFFER,
        sessionId,
        callType,
        sdp: offer,
      });

      return true;
    } catch (error) {
      const message = error?.message || "Failed to start the call";
      set({ lastError: message });
      get().clearCall();
      toast.error(message);
      return false;
    }
  },

  acceptIncomingCall: async () => {
    if (get().callPhase !== "incoming") return;

    const { peerUser, callType, sessionId, incomingOffer } = get();
    if (!peerUser?._id || !sessionId || !incomingOffer) {
      get().clearCall();
      return;
    }

    try {
      const localStream = await acquireLocalStream(callType);

      set({
        callPhase: "connecting",
        localStream,
        peerConnection: null,
        remoteStream: null,
        isMicrophoneMuted: false,
        isCameraEnabled: callType === "video",
      });

      const peerConnection = get().createPeerConnection();
      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOffer));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      await get().sendSignal(peerUser._id, {
        type: CALL_SIGNAL_TYPES.ANSWER,
        sessionId,
        sdp: answer,
      });

      set({ incomingOffer: null });
      await get().flushPendingCandidates();
    } catch (error) {
      const message = error?.message || "Failed to answer the call";
      set({ lastError: message });
      get().clearCall();
      toast.error(message);
    }
  },

  rejectIncomingCall: async () => {
    if (get().callPhase !== "incoming") return;

    const { peerUser, sessionId } = get();
    if (peerUser?._id && sessionId) {
      try {
        await get().sendSignal(peerUser._id, {
          type: CALL_SIGNAL_TYPES.REJECT,
          sessionId,
        });
      } catch {
        // Ignore rejection signaling failures.
      }
    }

    get().clearCall();
  },

  endCall: async () => {
    const { peerUser, sessionId, callPhase } = get();

    if (peerUser?._id && sessionId && callPhase !== "idle") {
      try {
        await get().sendSignal(peerUser._id, {
          type: CALL_SIGNAL_TYPES.HANGUP,
          sessionId,
        });
      } catch {
        // Ignore hangup signaling failures.
      }
    }

    get().clearCall();
  },

  toggleMicrophone: () => {
    const { localStream, isMicrophoneMuted } = get();
    if (!localStream) return;

    const nextMuted = !isMicrophoneMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });

    set({ isMicrophoneMuted: nextMuted });
  },

  toggleCamera: () => {
    const { callType, localStream, isCameraEnabled } = get();
    if (callType !== "video" || !localStream) return;

    const nextEnabled = !isCameraEnabled;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });

    set({ isCameraEnabled: nextEnabled });
  },
}));