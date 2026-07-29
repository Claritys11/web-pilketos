/**
 * SupabaseStorageService — Production implementation of IStorageService.
 *
 * Uses Supabase Storage SDK with the service role key (server-side only).
 * The service role key bypasses Row Level Security — this class must
 * NEVER be instantiated in browser/client code.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §StorageService Abstraction
 * Reference: 05_SECURITY.md §File Upload Security
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { StorageError, type IStorageService } from "./index";

export class SupabaseStorageService implements IStorageService {
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(supabaseUrl: string, serviceRoleKey: string, bucket: string) {
    this.client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    this.bucket = bucket;
    this.baseUrl = supabaseUrl;
  }

  async uploadFile(path: string, buffer: Buffer | Uint8Array, mimeType: string): Promise<string> {
    const { error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    if (error) {
      throw new StorageError(`Failed to upload file to '${path}': ${error.message}`, error);
    }

    return this.getPublicUrl(path);
  }

  async deleteFile(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);

    if (error) {
      throw new StorageError(`Failed to delete file at '${path}': ${error.message}`, error);
    }
  }

  getPublicUrl(path: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async ping(): Promise<"ok" | string> {
    try {
      const { error } = await this.client.storage.getBucket(this.bucket);
      if (error) {
        return `storage error: ${error.message}`;
      }
      return "ok";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `storage unreachable: ${message}`;
    }
  }
}
