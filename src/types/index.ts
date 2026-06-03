/**
 * Shared TypeScript types and interfaces for Portal Gestión de Comités.
 *
 * Re-exports Prisma enums for convenience and defines application-level
 * interfaces used across services, actions, and components.
 */

import type { Rol } from '@prisma/client';

// Re-export Prisma enums so consumers can import from a single location
export type { Rol, EstadoActa, EstadoCarga, EstadoProcesamiento } from '@prisma/client';

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Data stored in the encrypted iron-session cookie. */
export interface SessionData {
  userId: string;
  nombreCompleto: string;
  usuario: string;
  cargo: string;
  rol: Rol;
  correo: string;
  /** ISO timestamp in America/Bogota timezone */
  loginAt: string;
  /** ISO timestamp for inactivity tracking */
  lastActivity: string;
}

// ---------------------------------------------------------------------------
// Action Result (standard response envelope)
// ---------------------------------------------------------------------------

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_INACTIVE'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SEQUENCE_EXHAUSTED'
  | 'FILE_TOO_LARGE'
  | 'INVALID_FILE_TYPE'
  | 'MIME_MISMATCH'
  | 'GENERATION_FAILED'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    fieldErrors?: Record<string, string>;
  };
}

// ---------------------------------------------------------------------------
// AI Provider
// ---------------------------------------------------------------------------

/** Committee type identifiers used for sequence numbering and AI context. */
export type TipoComite = 'Curricular' | 'Investigación' | 'Decanatura' | 'Otro';

/** Input for AI-based acta content generation. */
export interface ActaGenerationInput {
  ordenDia: string;
  asistentes: { nombre: string; cargo: string }[];
  attachmentTexts: string[];
  tipoComite: TipoComite;
  areaPrograma: string;
}

/** Result from AI acta generation. */
export interface ActaGenerationResult {
  desarrollo: string;
  success: boolean;
  /** Which provider generated the content (e.g. 'openai', 'anthropic', 'fallback') */
  provider: string;
  error?: string;
}

/** Strategy interface for AI providers. */
export interface IAIProvider {
  generateActaContent(input: ActaGenerationInput): Promise<ActaGenerationResult>;
  extractTextFromDocument(buffer: Buffer, mimeType: string): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Sequence Service
// ---------------------------------------------------------------------------

export interface SequenceResult {
  success: boolean;
  /** Formatted sequence string, e.g. "ACTA-CUR-2026-0001" */
  numero: string;
  /** Numeric value of the sequence, e.g. 1 */
  secuencia: number;
  /** Year the sequence belongs to */
  anio: number;
  error?: string;
}

export interface ISequenceService {
  getNextNumber(committeeCode: string, year: number): Promise<SequenceResult>;
}

// ---------------------------------------------------------------------------
// Document Generator
// ---------------------------------------------------------------------------

/** Data required to fill the DOCX template placeholders. */
export interface ActaDocxData {
  numeroActa: string;
  ciudadFecha: string;
  hora: string;
  lugar: string;
  asistentes: { nombre: string; cargo: string }[];
  ordenDia: string;
  desarrollo: string;
  proyecto: string;
  reviso: string;
  copia?: string;
}

/** Result of DOCX generation. */
export interface GeneratedDocument {
  buffer: Buffer;
  filename: string;
  /** Size in bytes */
  size: number;
}

export interface IDocumentGenerator {
  generateActaDocx(data: ActaDocxData): Promise<GeneratedDocument>;
}

// ---------------------------------------------------------------------------
// File Storage
// ---------------------------------------------------------------------------

/** Metadata associated with a file upload. */
export interface FileMetadata {
  originalName: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  actaId: string;
}

/** Result of a storage operation. */
export interface StorageResult {
  success: boolean;
  storagePath: string;
  url?: string;
  error?: string;
}

export interface IFileStorage {
  upload(file: Buffer, path: string, metadata: FileMetadata): Promise<StorageResult>;
  delete(storagePath: string): Promise<void>;
  getStream(storagePath: string): Promise<ReadableStream>;
  getUrl(storagePath: string): string;
}

// ---------------------------------------------------------------------------
// Audit Logger
// ---------------------------------------------------------------------------

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'DOWNLOAD'
  | 'GENERATE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'SESSION_CREATED'
  | 'SESSION_EXPIRED'
  | 'UPLOAD'
  | 'FILE_DELETE';

export interface AuditEntry {
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadataJson?: Record<string, unknown>;
  ipAddress: string;
}

export interface IAuditLogger {
  /** Fire-and-forget, non-blocking audit log write. */
  log(entry: AuditEntry): void;
}
