/**
 * Application-wide constants for Portal Gestión de Comités.
 *
 * Centralizes file validation rules, pagination defaults, committee
 * configuration, and role permissions so they can be shared across
 * client and server code.
 */

// ---------------------------------------------------------------------------
// File Upload Constants
// ---------------------------------------------------------------------------

/** Allowed file extensions for attachment uploads. */
export const ALLOWED_EXTENSIONS = [
  '.docx',
  '.doc',
  '.pdf',
  '.xlsx',
  '.xls',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.txt',
  '.csv',
  '.pptx',
] as const;

export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

/** Mapping from file extensions to their expected MIME types. */
export const MIME_TYPE_MAP: Record<AllowedExtension, string[]> = {
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.doc': ['application/msword'],
  '.pdf': ['application/pdf'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.xls': ['application/vnd.ms-excel'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.mp3': ['audio/mpeg', 'audio/mp3'],
  '.mp4': ['video/mp4'],
  '.wav': ['audio/wav', 'audio/x-wav'],
  '.avi': ['video/x-msvideo', 'video/avi'],
  '.txt': ['text/plain'],
  '.csv': ['text/csv', 'application/csv'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

/** Extensions that support text extraction by the AI provider. */
export const EXTRACTABLE_EXTENSIONS: AllowedExtension[] = [
  '.docx',
  '.doc',
  '.pdf',
  '.xlsx',
  '.xls',
  '.txt',
  '.csv',
];

/** Media extensions that are stored but content is not extracted. */
export const MEDIA_EXTENSIONS: AllowedExtension[] = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
];

/** Maximum number of files allowed per acta. */
export const MAX_FILE_COUNT = 20;

/** Default max file size in MB (overridable via MAX_FILE_SIZE_MB env var). */
export const DEFAULT_MAX_FILE_SIZE_MB = 10;

// ---------------------------------------------------------------------------
// Pagination Defaults
// ---------------------------------------------------------------------------

export const PAGINATION = {
  /** Maximum rows per page in the actas table. */
  ACTAS_PER_PAGE: 10,
  /** Maximum rows per page in the users admin table. */
  USERS_PER_PAGE: 20,
} as const;

// ---------------------------------------------------------------------------
// Committee Configuration
// ---------------------------------------------------------------------------

/** Committee type prefixes used in sequential numbering. */
export const COMMITTEE_PREFIXES = {
  Curricular: 'CUR',
  Investigación: 'INV',
  'Consejo de Facultad': 'COF',
} as const;

export type CommitteePrefix = (typeof COMMITTEE_PREFIXES)[keyof typeof COMMITTEE_PREFIXES];

/** Available committee types. */
export const COMMITTEE_TYPES = [
  'Curricular',
  'Investigación',
  'Consejo de Facultad',
] as const;

/** Available academic programs. */
export const PROGRAMS = [
  'Ingeniería Industrial',
  'Ingeniería Electrónica',
  'Ingeniería Ambiental',
  'Facultad de Ingeniería',
] as const;

// ---------------------------------------------------------------------------
// Role Permissions
// ---------------------------------------------------------------------------

/**
 * Permissions matrix per role.
 *
 * Each key is a feature/action, and the value indicates whether the role
 * is allowed to perform it.
 */
export const ROLE_PERMISSIONS = {
  Administrador: {
    accessAdminModule: true,
    createActa: true,
    downloadActa: true,
    retryGeneration: true,
    viewActaDetail: true,
    viewAttachments: true,
    viewStatus: true,
    manageUsers: true,
  },
  Usuario_Gestor: {
    accessAdminModule: false,
    createActa: true,
    downloadActa: true,
    retryGeneration: true,
    viewActaDetail: true,
    viewAttachments: true,
    viewStatus: true,
    manageUsers: false,
  },
  Consulta: {
    accessAdminModule: false,
    createActa: false,
    downloadActa: false,
    retryGeneration: false,
    viewActaDetail: true,
    viewAttachments: true,
    viewStatus: true,
    manageUsers: false,
  },
} as const;

export type Permission = keyof (typeof ROLE_PERMISSIONS)['Administrador'];

// ---------------------------------------------------------------------------
// Sequence Constants
// ---------------------------------------------------------------------------

/** Maximum sequence number before exhaustion (4-digit zero-padded). */
export const MAX_SEQUENCE_NUMBER = 9999;

/** Number of retry attempts for sequence generation under contention. */
export const SEQUENCE_MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Session Constants
// ---------------------------------------------------------------------------

/** Session inactivity timeout in minutes. */
export const SESSION_INACTIVITY_TIMEOUT_MINUTES = 30;

/** Absolute session lifetime in hours. */
export const SESSION_MAX_LIFETIME_HOURS = 8;

/** Maximum consecutive failed login attempts before account lock. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;

/** Account lock duration in minutes after exceeding failed attempts. */
export const ACCOUNT_LOCK_DURATION_MINUTES = 15;

// ---------------------------------------------------------------------------
// Application Timezone
// ---------------------------------------------------------------------------

export const APP_TIMEZONE = 'America/Bogota';
