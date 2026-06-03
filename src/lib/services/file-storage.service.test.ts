/**
 * Unit tests for the file storage service.
 *
 * Tests LocalFileStorage (filesystem-based) and the factory function.
 * VercelBlobStorage is tested with mocked @vercel/blob SDK.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import type { FileMetadata } from '@/types';

// Mock @vercel/blob at module level (hoisted by vitest)
const mockPut = vi.fn();
const mockDel = vi.fn();

vi.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel,
}));

// Import after mock setup
import {
  LocalFileStorage,
  VercelBlobStorage,
  createFileStorage,
} from './file-storage.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

const TEST_UPLOADS_DIR = path.resolve(process.cwd(), 'test-uploads-temp');

function createTestMetadata(overrides?: Partial<FileMetadata>): FileMetadata {
  return {
    originalName: 'test-document.pdf',
    mimeType: 'application/pdf',
    extension: '.pdf',
    sizeBytes: 1024,
    actaId: 'acta-123',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// LocalFileStorage Tests
// ---------------------------------------------------------------------------

describe('LocalFileStorage', () => {
  let storage: LocalFileStorage;

  beforeEach(async () => {
    storage = new LocalFileStorage(TEST_UPLOADS_DIR);
    await fs.mkdir(TEST_UPLOADS_DIR, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(TEST_UPLOADS_DIR, { recursive: true, force: true });
  });

  describe('upload', () => {
    it('should store a file and return a success result with storage path', async () => {
      const file = Buffer.from('test file content');
      const metadata = createTestMetadata();

      const result = await storage.upload(file, '', metadata);

      expect(result.success).toBe(true);
      expect(result.storagePath).toContain('acta-123');
      expect(result.storagePath).toContain('test-document.pdf');
    });

    it('should create subdirectories based on actaId', async () => {
      const file = Buffer.from('content');
      const metadata = createTestMetadata({ actaId: 'acta-456' });

      const result = await storage.upload(file, '', metadata);

      expect(result.success).toBe(true);
      const fullPath = path.join(TEST_UPLOADS_DIR, result.storagePath);
      const fileExists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);
    });

    it('should sanitize the filename', async () => {
      const file = Buffer.from('content');
      const metadata = createTestMetadata({
        originalName: '../../../etc/passwd.txt',
      });

      const result = await storage.upload(file, '', metadata);

      expect(result.success).toBe(true);
      expect(result.storagePath).not.toContain('..');
      expect(result.storagePath).not.toContain('/etc/');
    });

    it('should include a timestamp in the storage path', async () => {
      const file = Buffer.from('content');
      const metadata = createTestMetadata();

      const before = Date.now();
      const result = await storage.upload(file, '', metadata);
      const after = Date.now();

      // Extract timestamp from path (format: actaId/timestamp-filename)
      const parts = result.storagePath.split(/[/\\]/);
      const filename = parts[parts.length - 1];
      const timestamp = parseInt(filename.split('-')[0], 10);

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should write the correct file content', async () => {
      const fileContent = 'Hello, this is test content!';
      const file = Buffer.from(fileContent);
      const metadata = createTestMetadata();

      const result = await storage.upload(file, '', metadata);
      const fullPath = path.join(TEST_UPLOADS_DIR, result.storagePath);
      const storedContent = await fs.readFile(fullPath, 'utf-8');

      expect(storedContent).toBe(fileContent);
    });

    it('should return an error result when write fails', async () => {
      // Use a path with invalid characters that cannot be created on any OS
      const badStorage = new LocalFileStorage(
        path.join(TEST_UPLOADS_DIR, 'file-that-exists-as-dir\0invalid')
      );
      const file = Buffer.from('content');
      const metadata = createTestMetadata();

      const result = await badStorage.upload(file, '', metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to store file locally');
    });
  });

  describe('delete', () => {
    it('should delete an existing file', async () => {
      const file = Buffer.from('content');
      const metadata = createTestMetadata();
      const uploaded = await storage.upload(file, '', metadata);

      await storage.delete(uploaded.storagePath);

      const fullPath = path.join(TEST_UPLOADS_DIR, uploaded.storagePath);
      const exists = await fs
        .access(fullPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it('should not throw when deleting a non-existent file', async () => {
      await expect(
        storage.delete('non-existent/file.pdf')
      ).resolves.not.toThrow();
    });
  });

  describe('getStream', () => {
    it('should return a readable stream for an existing file', async () => {
      const fileContent = 'stream test content';
      const file = Buffer.from(fileContent);
      const metadata = createTestMetadata();
      const uploaded = await storage.upload(file, '', metadata);

      const stream = await storage.getStream(uploaded.storagePath);
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];

      let done = false;
      while (!done) {
        const result = await reader.read();
        if (result.done) {
          done = true;
        } else {
          chunks.push(result.value);
        }
      }

      const content = Buffer.concat(chunks).toString('utf-8');
      expect(content).toBe(fileContent);
    });

    it('should throw when file does not exist', async () => {
      await expect(
        storage.getStream('non-existent/file.pdf')
      ).rejects.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return an authenticated API route URL', () => {
      const url = storage.getUrl('acta-123/12345-doc.pdf');
      expect(url).toContain('/api/files/');
      expect(url).toContain(encodeURIComponent('acta-123/12345-doc.pdf'));
    });
  });
});

// ---------------------------------------------------------------------------
// VercelBlobStorage Tests (with mocked SDK)
// ---------------------------------------------------------------------------

describe('VercelBlobStorage', () => {
  let storage: VercelBlobStorage;

  beforeEach(() => {
    storage = new VercelBlobStorage();
    mockPut.mockReset();
    mockDel.mockReset();
  });

  describe('upload', () => {
    it('should call put with correct path and options', async () => {
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/attachments/acta-123/file.pdf',
      });
      const file = Buffer.from('content');
      const metadata = createTestMetadata();

      const result = await storage.upload(file, '', metadata);

      expect(result.success).toBe(true);
      expect(result.url).toBe(
        'https://blob.vercel-storage.com/attachments/acta-123/file.pdf'
      );
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('attachments/acta-123/'),
        file,
        { access: 'public', contentType: 'application/pdf' }
      );
    });

    it('should return error when put fails', async () => {
      mockPut.mockRejectedValue(new Error('Blob service unavailable'));
      const file = Buffer.from('content');
      const metadata = createTestMetadata();

      const result = await storage.upload(file, '', metadata);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to store file in Vercel Blob');
    });

    it('should sanitize the filename in the blob path', async () => {
      mockPut.mockResolvedValue({ url: 'https://blob.example.com/file' });
      const file = Buffer.from('content');
      const metadata = createTestMetadata({
        originalName: '../../malicious<script>.pdf',
      });

      await storage.upload(file, '', metadata);

      const calledPath = mockPut.mock.calls[0][0] as string;
      expect(calledPath).not.toContain('..');
      expect(calledPath).not.toContain('<');
      expect(calledPath).not.toContain('>');
    });
  });

  describe('delete', () => {
    it('should call del with the storage path', async () => {
      mockDel.mockResolvedValue(undefined);

      await storage.delete('attachments/acta-123/file.pdf');

      expect(mockDel).toHaveBeenCalledWith('attachments/acta-123/file.pdf');
    });

    it('should not throw when del fails', async () => {
      mockDel.mockRejectedValue(new Error('Network error'));

      await expect(
        storage.delete('some-path/file.pdf')
      ).resolves.not.toThrow();
    });
  });

  describe('getUrl', () => {
    it('should return an authenticated API route URL', () => {
      const url = storage.getUrl('attachments/acta-123/file.pdf');
      expect(url).toContain('/api/files/');
    });
  });
});

// ---------------------------------------------------------------------------
// Factory Function Tests
// ---------------------------------------------------------------------------

describe('createFileStorage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return LocalFileStorage when STORAGE_PROVIDER is not set', () => {
    delete process.env.STORAGE_PROVIDER;
    const storage = createFileStorage();
    expect(storage).toBeInstanceOf(LocalFileStorage);
  });

  it('should return LocalFileStorage when STORAGE_PROVIDER is empty', () => {
    process.env.STORAGE_PROVIDER = '';
    const storage = createFileStorage();
    expect(storage).toBeInstanceOf(LocalFileStorage);
  });

  it('should return LocalFileStorage for unknown provider values', () => {
    process.env.STORAGE_PROVIDER = 'unknown-provider';
    const storage = createFileStorage();
    expect(storage).toBeInstanceOf(LocalFileStorage);
  });

  it('should return VercelBlobStorage when STORAGE_PROVIDER is "vercel-blob"', () => {
    process.env.STORAGE_PROVIDER = 'vercel-blob';
    const storage = createFileStorage();
    expect(storage).toBeInstanceOf(VercelBlobStorage);
  });
});
