/**
 * StorageService — Interface for file storage operations.
 *
 * Application code (CandidateService, etc.) must depend on this interface,
 * not on any specific provider SDK (Supabase, S3, etc.).
 *
 * This decoupling allows:
 *   - Switching storage providers without touching business logic.
 *   - Using LocalStorageService during development/testing.
 *   - Mocking storage in unit tests.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §StorageService Abstraction
 * Reference: 07_DEVELOPMENT_ROADMAP.md §Phase 0 — Storage Service Abstraction
 *
 * Usage:
 *   import { storageService } from "@/lib/storage";
 *   const url = await storageService.uploadFile("candidates/photo.webp", buffer, "image/webp");
 */

// ---------------------------------------------------------------------------
// Supported MIME types for candidate photo uploads
// Reference: 05_SECURITY.md §File Upload Security
// ---------------------------------------------------------------------------

export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface IStorageService {
  /**
   * Upload a file buffer to the given storage path.
   *
   * @param path - Destination path within the storage bucket (e.g. "candidates/abc123.webp")
   * @param buffer - File content as a Buffer or Uint8Array
   * @param mimeType - MIME type of the file (e.g. "image/webp")
   * @returns The public URL of the uploaded file
   * @throws StorageError if the upload fails
   */
  uploadFile(path: string, buffer: Buffer | Uint8Array, mimeType: string): Promise<string>;

  /**
   * Delete a file at the given storage path.
   *
   * @param path - Path of the file to delete within the storage bucket
   * @throws StorageError if the deletion fails
   */
  deleteFile(path: string): Promise<void>;

  /**
   * Get the public URL for a file at the given path.
   * This is a synchronous URL computation — no network request.
   *
   * @param path - Path of the file within the storage bucket
   * @returns Absolute public URL of the file
   */
  getPublicUrl(path: string): string;

  /**
   * Health check — verify that the storage service is reachable.
   * Used by GET /api/health.
   *
   * @returns "ok" if storage is reachable, or an error message string
   */
  ping(): Promise<"ok" | string>;
}

// ---------------------------------------------------------------------------
// Custom error type
// ---------------------------------------------------------------------------

export class StorageError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

// ---------------------------------------------------------------------------
// Default export — resolved based on environment
// ---------------------------------------------------------------------------

import { config } from "@/config/env";
import { SupabaseStorageService } from "./supabase";

/**
 * The application-wide storage service instance.
 *
 * In production: SupabaseStorageService
 * In tests: inject a mock that implements IStorageService
 *
 * The bucket name is hardcoded per architecture — one bucket per deployment.
 */
const CANDIDATE_PHOTOS_BUCKET = "candidate-photos";

export const storageService: IStorageService = new SupabaseStorageService(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  CANDIDATE_PHOTOS_BUCKET,
);
