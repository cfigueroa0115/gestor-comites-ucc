/**
 * Unit tests for the authenticated file serving API route.
 *
 * Tests:
 * - Returns 401 when no valid session exists
 * - Returns 404 when attachment is not found in the database
 * - Returns file stream with correct headers when attachment exists
 * - Returns 404 when file exists in DB but not in storage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock iron-session
const mockSession: Record<string, unknown> = {};
vi.mock('iron-session', () => ({
  getIronSession: vi.fn(() => Promise.resolve(mockSession)),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({})),
}));

// Mock prisma
const mockFindUnique = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    attachment: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Mock file storage service
const mockGetStream = vi.fn();
vi.mock('@/lib/services/file-storage.service', () => ({
  getFileStorage: () => ({
    getStream: mockGetStream,
  }),
}));

// Mock session module
vi.mock('@/lib/auth/session', () => ({
  sessionOptions: {
    cookieName: 'gestor_comites_session',
    cookieOptions: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 28800,
    },
  },
}));

import { GET } from './route';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Test Helpers
// ---------------------------------------------------------------------------

function createRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/files/${id}`);
}

function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

const sampleAttachment = {
  id: 'attachment-123',
  actaId: 'acta-456',
  nombreArchivo: 'documento-soporte.pdf',
  tipoMime: 'application/pdf',
  extension: '.pdf',
  sizeBytes: 2048,
  storagePath: 'acta-456/1700000000000-documento-soporte.pdf',
  estadoCarga: 'completado',
  estadoProcesamiento: 'completado',
  textoExtraido: null,
  errorProcesamiento: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/files/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset session state
    Object.keys(mockSession).forEach((key) => delete mockSession[key]);
  });

  describe('Authentication', () => {
    it('should return 401 when no session exists (userId is undefined)', async () => {
      // Session has no userId
      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain('No autenticado');
    });

    it('should return 401 when session userId is empty', async () => {
      mockSession.userId = '';
      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toContain('No autenticado');
    });
  });

  describe('File lookup', () => {
    it('should return 404 when attachment ID does not exist in database', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(null);

      const request = createRequest('non-existent-id');
      const response = await GET(request, { params: createParams('non-existent-id') });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('no encontrado');
    });

    it('should query the database with the correct attachment ID', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(null);

      const request = createRequest('test-id-789');
      await GET(request, { params: createParams('test-id-789') });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'test-id-789' } });
    });
  });

  describe('File streaming', () => {
    it('should return file stream with correct Content-Type header', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      const fakeStream = new ReadableStream();
      mockGetStream.mockResolvedValue(fakeStream);

      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
    });

    it('should return file stream with Content-Disposition header', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      const fakeStream = new ReadableStream();
      mockGetStream.mockResolvedValue(fakeStream);

      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      const disposition = response.headers.get('Content-Disposition');
      expect(disposition).toContain('inline');
      expect(disposition).toContain('documento-soporte.pdf');
    });

    it('should return file stream with Content-Length header', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      const fakeStream = new ReadableStream();
      mockGetStream.mockResolvedValue(fakeStream);

      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.headers.get('Content-Length')).toBe('2048');
    });

    it('should set Cache-Control to private, no-cache', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      const fakeStream = new ReadableStream();
      mockGetStream.mockResolvedValue(fakeStream);

      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
    });

    it('should call getStream with the correct storage path', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      const fakeStream = new ReadableStream();
      mockGetStream.mockResolvedValue(fakeStream);

      const request = createRequest('attachment-123');
      await GET(request, { params: createParams('attachment-123') });

      expect(mockGetStream).toHaveBeenCalledWith(
        'acta-456/1700000000000-documento-soporte.pdf'
      );
    });
  });

  describe('Storage errors', () => {
    it('should return 404 when storage getStream throws (file not on disk)', async () => {
      mockSession.userId = 'user-1';
      mockFindUnique.mockResolvedValue(sampleAttachment);
      mockGetStream.mockRejectedValue(new Error('ENOENT: no such file'));

      const request = createRequest('attachment-123');
      const response = await GET(request, { params: createParams('attachment-123') });

      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toContain('No se pudo recuperar');
    });
  });
});
