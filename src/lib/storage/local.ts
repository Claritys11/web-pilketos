/**
 * LocalStorageService — Development/testing implementation of IStorageService.
 *
 * Stores files on the local filesystem under the `public/uploads/` directory.
 * This allows development and testing WITHOUT a Supabase account.
 *
 * DO NOT use this in production. It is intended for:
 *   - Local development when Supabase is not configured.
 *   - Unit tests that need to verify upload behavior.
 *
 * Reference: 02_SYSTEM_ARCHITECTURE.md §StorageService Abstraction
 */

import fs from "node:fs/promises";
import path from "node:path";
import { StorageError, type IStorageService } from "./index";

export class LocalStorageService implements IStorageService {
  private readonly baseDir: string;

  constructor(baseDir: string, _baseUrl: string) {
    this.baseDir = baseDir;
  }

  async uploadFile(
    filePath: string,
    buffer: Buffer | Uint8Array,
    _mimeType: string,
  ): Promise<string> {
    const fullPath = path.join(this.baseDir, filePath);
    const dir = path.dirname(fullPath);

    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(fullPath, buffer);
      return this.getPublicUrl(filePath);
    } catch (err) {
      throw new StorageError(`LocalStorageService: Failed to write file at '${fullPath}'`, err);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);

    try {
      await fs.unlink(fullPath);
    } catch (err) {
      // Ignore ENOENT — file already gone is not an error
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new StorageError(`LocalStorageService: Failed to delete file at '${fullPath}'`, err);
      }
    }
  }

  getPublicUrl(filePath: string): string {
    // Normalize path separators to forward slashes for URL compatibility
    const normalized = filePath.replace(/\\/g, "/");
    return `/uploads/${normalized}`;
  }

  async ping(): Promise<"ok" | string> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.access(this.baseDir);
      return "ok";
    } catch {
      return `local storage directory not accessible: ${this.baseDir}`;
    }
  }
}
