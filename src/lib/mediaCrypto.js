const MEDIA_KEY_PREFIX = "chat-media-key-v1:";
const PBKDF2_ITERATIONS = 150000;
const AES_GCM_IV_LENGTH = 12;

function normalizePassphrase(passphrase) {
  if (typeof passphrase !== "string") return "";
  return passphrase.trim();
}

function getConversationKeyId(userAId, userBId) {
  return [userAId, userBId].sort().join(":");
}

function getStorageKey(userAId, userBId) {
  return `${MEDIA_KEY_PREFIX}${getConversationKeyId(userAId, userBId)}`;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function getConversationMediaPassphrase(userAId, userBId) {
  if (typeof window === "undefined") return null;

  const rawPassphrase = localStorage.getItem(getStorageKey(userAId, userBId));
  const normalizedPassphrase = normalizePassphrase(rawPassphrase);

  return normalizedPassphrase || null;
}

async function deriveConversationMediaKey(passphrase, userAId, userBId) {
  const normalizedPassphrase = normalizePassphrase(passphrase);
  if (!normalizedPassphrase) {
    throw new Error("Missing media passphrase for this conversation");
  }

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(normalizedPassphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(`chat-media:${getConversationKeyId(userAId, userBId)}`),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export function setConversationMediaPassphrase(userAId, userBId, passphrase) {
  if (typeof window === "undefined") return;

  const normalizedPassphrase = normalizePassphrase(passphrase);
  const storageKey = getStorageKey(userAId, userBId);

  if (!normalizedPassphrase) {
    localStorage.removeItem(storageKey);
    return false;
  }

  localStorage.setItem(storageKey, normalizedPassphrase);
  return true;
}

export function hasConversationMediaPassphrase(userAId, userBId) {
  return Boolean(getConversationMediaPassphrase(userAId, userBId));
}

export async function encryptImageFileForConversation({ file, userAId, userBId }) {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable in this browser");
  }

  const passphrase = getConversationMediaPassphrase(userAId, userBId);
  if (!passphrase) {
    throw new Error("Missing media passphrase for this conversation");
  }

  const key = await deriveConversationMediaKey(passphrase, userAId, userBId);
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    fileBytes
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);

  return {
    encryptedDataUrl: `data:application/octet-stream;base64,${bytesToBase64(encryptedBytes)}`,
    imageMeta: {
      encrypted: true,
      iv: bytesToBase64(iv),
      mimeType: file.type || "application/octet-stream",
      fileName: file.name || null,
    },
  };
}

export async function decryptEncryptedImageFromUrl({ url, iv, mimeType, userAId, userBId }) {
  if (!crypto?.subtle) {
    throw new Error("Web Crypto API is unavailable in this browser");
  }

  const passphrase = getConversationMediaPassphrase(userAId, userBId);
  if (!passphrase) {
    throw new Error("Missing media passphrase for this conversation");
  }

  const key = await deriveConversationMediaKey(passphrase, userAId, userBId);
  const encryptedResponse = await fetch(url);

  if (!encryptedResponse.ok) {
    const downloadError = new Error("Unable to download encrypted media");
    downloadError.code = "download_failed";
    throw downloadError;
  }

  const encryptedBytes = new Uint8Array(await encryptedResponse.arrayBuffer());

  let decryptedBuffer;

  try {
    decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(iv),
      },
      key,
      encryptedBytes
    );
  } catch {
    const decryptError = new Error("Invalid media passphrase for this conversation");
    decryptError.code = "invalid_passphrase";
    throw decryptError;
  }

  const blob = new Blob([decryptedBuffer], { type: mimeType || "application/octet-stream" });
  return URL.createObjectURL(blob);
}