import crypto from "node:crypto";

export const PHOTO_SIGNATURES = {
  "image/jpeg": {
    extensions: ["jpg", "jpeg"],
    matches: (buffer: Uint8Array) =>
      buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  "image/png": {
    extensions: ["png"],
    matches: (buffer: Uint8Array) => {
      const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      return signature.every((byte, index) => buffer[index] === byte);
    },
  },
  "image/webp": {
    extensions: ["webp"],
    matches: (buffer: Uint8Array) => {
      const riff = String.fromCharCode(...buffer.slice(0, 4));
      const webp = String.fromCharCode(...buffer.slice(8, 12));
      return buffer.length >= 12 && riff === "RIFF" && webp === "WEBP";
    },
  },
} as const;

export type PhotoMimeType = keyof typeof PHOTO_SIGNATURES;
export type PhotoExtension = "jpg" | "jpeg" | "png" | "webp";

export function normalizeFilenameExtension(filename: string): string | null {
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== filename.toLowerCase() ? extension : null;
}

export function isAllowedPhotoMimeType(mimeType: string): mimeType is PhotoMimeType {
  return mimeType in PHOTO_SIGNATURES;
}

export function validatePhotoSignature(buffer: Uint8Array, mimeType: PhotoMimeType) {
  return PHOTO_SIGNATURES[mimeType].matches(buffer);
}

export function validatePhotoExtension(
  extension: string | null,
  mimeType: PhotoMimeType,
): extension is PhotoExtension {
  if (!extension) {
    return false;
  }

  return (PHOTO_SIGNATURES[mimeType].extensions as readonly string[]).includes(extension);
}

export function createStorageCuid() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(12).toString("base64url").toLowerCase();
  return `c${timestamp}${random.replace(/[^a-z0-9]/g, "").slice(0, 18)}`;
}
