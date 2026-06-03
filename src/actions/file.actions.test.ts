/**
 * Unit tests for file upload and delete server actions.
 *
 * Tests the validation pipeline (extension, MIME, size, sanitization)
 * and the interaction with storage and database.
 *
 * Validates: Requirements 7.2, 7.3, 7.6, 7.7, 7.8, 7.9, 13.6
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/auth/guards', () => ({
  requireGestor: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    acta: {
      findUnique: vi.fn(),
    },
    attachment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@/lib/services/file-storage.service', () => ({
  getFileStorage: vi.fn(),
}));

vi.mock('@/lib/services/audit.service', () => ({
  auditLogger: {
    log: vi.fn(),
  },
}));

import { uploadFileAction, deleteFileAction } from './file.actions';
import { requireGestor } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getFileStorage } from '@/lib/services/file-storage.service';
import { auditLogger } from '@/lib/services/audit.service';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createMockFile(
  name: string,
  type: string,
  size: number,
): File {
  // Create a buffer of the exact requested size to properly test size validation
  const content = new Uint8Array(size);
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
}

function createFormData(file: File, actaId: string): FormData {
  const formData = new FormData();
  formData.set('file', file);
  formData.set('actaId', actaId);
  return formData;
}

const mockSession = {
  userId: 'user-123',
  nombreCompleto: 'Test User',
  usuario: 'testuser',
  cargo: 'Ingeniero',
  rol: 'Usuario_Gestor' as const,
  correo: 'test@ucc.edu.co',
  loginAt: new Date().toISOString(),
  lastActivity: new Date().toISOString(),
};

const mockStorage = {
  upload: vi.fn(),
  delete: vi.fn(),
  getStream: vi.fn(),
  getUrl: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('uploadFileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireGestor as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (getFileStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);
    (prisma.acta.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'acta-001' });
    (prisma.attachment.create as ReturnType<typeof vi.fn>).mockImplementation(
      ({ data }) => Promise.resolve({ id: 'att-001', ...data }),
    );
    mockStorage.upload.mockResolvedValue({ success: true, storagePath: 'acta-001/123-document.pdf' });
  });

  describe('input validation', () => {
    it('should reject when no file is provided', async () => {
      const formData = new FormData();
      formData.set('actaId', 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('archivo');
    });

    it('should reject when no actaId is provided', async () => {
      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const formData = new FormData();
      formData.set('file', file);

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
      expect(result.error?.message).toContain('acta');
    });

    it('should reject when actaId is an empty string', async () => {
      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const formData = createFormData(file, '   ');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('extension allowlist validation', () => {
    it('should reject files with disallowed extensions', async () => {
      const file = createMockFile('virus.exe', 'application/octet-stream', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE_TYPE');
      expect(result.error?.message).toContain('.exe');
    });

    it('should reject files without extensions', async () => {
      const file = createMockFile('noextension', 'application/octet-stream', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_FILE_TYPE');
    });

    it('should accept files with allowed extensions', async () => {
      const file = createMockFile('document.pdf', 'application/pdf', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(true);
    });

    it('should handle case-insensitive extension matching', async () => {
      const file = createMockFile('document.PDF', 'application/pdf', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(true);
    });
  });

  describe('MIME type validation', () => {
    it('should reject files with MIME type mismatch', async () => {
      const file = createMockFile('fake.pdf', 'text/html', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('MIME_MISMATCH');
      expect(result.error?.message).toContain('tipo de contenido');
    });

    it('should accept files with matching MIME type', async () => {
      const file = createMockFile('report.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 2048);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(true);
    });
  });

  describe('file size validation', () => {
    it('should reject files exceeding MAX_FILE_SIZE_MB', async () => {
      // Default is 10MB; create a file that exceeds it
      const largeSize = 11 * 1024 * 1024; // 11MB
      const file = createMockFile('large.pdf', 'application/pdf', largeSize);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
      expect(result.error?.message).toContain('tamaño máximo');
    });

    it('should accept files within size limit', async () => {
      const file = createMockFile('small.pdf', 'application/pdf', 5 * 1024 * 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(true);
    });
  });

  describe('storage path generation', () => {
    it('should build path as {actaId}/{timestamp}-{sanitizedFilename}', async () => {
      const file = createMockFile('my document (1).pdf', 'application/pdf', 1024);
      const formData = createFormData(file, 'acta-001');

      await uploadFileAction(formData);

      const uploadCall = mockStorage.upload.mock.calls[0];
      const storagePath = uploadCall[1]; // second arg is the path
      expect(storagePath).toMatch(/^acta-001\/\d+-my_document_1\.pdf$/);
    });

    it('should sanitize dangerous filenames in the storage path', async () => {
      const file = createMockFile('../../etc/passwd.txt', 'text/plain', 100);
      const formData = createFormData(file, 'acta-001');

      await uploadFileAction(formData);

      const uploadCall = mockStorage.upload.mock.calls[0];
      const storagePath = uploadCall[1];
      // Path traversal sequences (../) must be removed
      expect(storagePath).not.toContain('..');
      expect(storagePath).not.toContain('/etc/');
      // The sanitized filename should be just alphanumeric + allowed chars
      expect(storagePath).toMatch(/^acta-001\/\d+-[a-zA-Z0-9._-]+$/);
    });
  });

  describe('database operations', () => {
    it('should verify acta exists before uploading', async () => {
      (prisma.acta.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const formData = createFormData(file, 'nonexistent-acta');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('should create Attachment record on successful upload', async () => {
      const file = createMockFile('report.pdf', 'application/pdf', 2048);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(true);
      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actaId: 'acta-001',
          tipoMime: 'application/pdf',
          extension: '.pdf',
          sizeBytes: 2048,
          estadoCarga: 'completado',
          estadoProcesamiento: 'pendiente',
        }),
      });
    });

    it('should set estadoProcesamiento to no_soportado for media files', async () => {
      const file = createMockFile('photo.png', 'image/png', 1024);
      const formData = createFormData(file, 'acta-001');

      await uploadFileAction(formData);

      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estadoProcesamiento: 'no_soportado',
        }),
      });
    });

    it('should set estadoProcesamiento to pendiente for extractable files', async () => {
      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const formData = createFormData(file, 'acta-001');

      await uploadFileAction(formData);

      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          estadoProcesamiento: 'pendiente',
        }),
      });
    });
  });

  describe('storage failure handling', () => {
    it('should return UPLOAD_FAILED when storage fails', async () => {
      mockStorage.upload.mockResolvedValue({
        success: false,
        storagePath: '',
        error: 'Disk full',
      });
      const file = createMockFile('doc.pdf', 'application/pdf', 1024);
      const formData = createFormData(file, 'acta-001');

      const result = await uploadFileAction(formData);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UPLOAD_FAILED');
    });
  });
});

describe('deleteFileAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireGestor as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (getFileStorage as ReturnType<typeof vi.fn>).mockReturnValue(mockStorage);
    mockStorage.delete.mockResolvedValue(undefined);
  });

  it('should reject when id is empty', async () => {
    const result = await deleteFileAction('');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('should return NOT_FOUND when attachment does not exist', async () => {
    (prisma.attachment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await deleteFileAction('nonexistent-id');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('should delete from storage and database on success', async () => {
    const mockAttachment = {
      id: 'att-001',
      actaId: 'acta-001',
      nombreArchivo: 'doc.pdf',
      storagePath: 'acta-001/123-doc.pdf',
    };
    (prisma.attachment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAttachment);
    (prisma.attachment.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockAttachment);

    const result = await deleteFileAction('att-001');

    expect(result.success).toBe(true);
    expect(mockStorage.delete).toHaveBeenCalledWith('acta-001/123-doc.pdf');
    expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-001' } });
  });

  it('should create audit log entry on deletion', async () => {
    const mockAttachment = {
      id: 'att-001',
      actaId: 'acta-001',
      nombreArchivo: 'doc.pdf',
      storagePath: 'acta-001/123-doc.pdf',
    };
    (prisma.attachment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockAttachment);
    (prisma.attachment.delete as ReturnType<typeof vi.fn>).mockResolvedValue(mockAttachment);

    await deleteFileAction('att-001');

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        action: 'FILE_DELETE',
        entityType: 'attachment',
        entityId: 'att-001',
      }),
    );
  });
});
