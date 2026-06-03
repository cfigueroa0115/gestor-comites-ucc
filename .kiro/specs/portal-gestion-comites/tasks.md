# Implementation Plan: Portal Gestión de Comités

## Overview

Implementación incremental en 12 fases de un portal full-stack con Next.js 14+ (App Router), Prisma ORM, iron-session, generación de documentos Word con IA, y despliegue en Vercel. Cada fase construye sobre la anterior, asegurando que no exista código huérfano. El proyecto es independiente en `C:\DesarrollosCF\Gestor_Comites`.

## Tasks

- [x] 1. Project Setup - Estructura base del proyecto Next.js
  - [x] 1.1 Initialize Next.js 14+ project with App Router, TypeScript, Tailwind CSS, and ESLint
    - Run `npx create-next-app@latest` with App Router, TypeScript, Tailwind, ESLint options
    - Configure `tsconfig.json` with path aliases (`@/` for `src/`)
    - Configure `tailwind.config.ts` with UCC institutional colors (green accent, white, light gray)
    - _Requirements: 14.6, 15.1_

  - [x] 1.2 Create project directory structure and placeholder files
    - Create full directory tree: `src/app/(public)`, `src/app/(protected)`, `src/app/api`, `src/components/ui`, `src/components/forms`, `src/components/actas`, `src/components/admin`, `src/lib/auth`, `src/lib/services/ai`, `src/lib/db`, `src/lib/validations`, `src/lib/utils`, `src/actions`, `src/types`, `prisma`, `templates`, `public/images`
    - _Requirements: 14.3_

  - [x] 1.3 Create Prisma schema with all models, enums, relations, and indexes
    - Define `schema.prisma` with generator, datasource (postgresql + env DATABASE_URL), enums (Rol, EstadoActa, EstadoCarga, EstadoProcesamiento), and models (User, Committee, Acta, Attachment, AuditLog, Sequence) with all fields, relations, indexes, and @@map annotations as specified in design
    - _Requirements: 12.2, 12.3, 12.7_

  - [x] 1.4 Create environment configuration files (.env.example, .gitignore, next.config.ts)
    - Create `.env.example` with all variables: DATABASE_URL, SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD, ADMIN_EMAIL, AI_PROVIDER, AI_API_KEY, AI_MODEL, MAX_FILE_SIZE_MB, BLOB_READ_WRITE_TOKEN, STORAGE_PROVIDER (placeholder values only, no real secrets)
    - Create `.gitignore` excluding: .env, .env.local, node_modules, .next, *.pem, *.key, /uploads
    - Configure `next.config.ts` with experimental serverActions and any needed settings
    - _Requirements: 13.1, 13.2, 13.3, 13.10, 14.4_

  - [x] 1.5 Install core dependencies and configure package.json scripts
    - Install: `prisma`, `@prisma/client`, `@neondatabase/serverless`, `iron-session`, `zod`, `bcryptjs`, `docxtemplater`, `pizzip`, `date-fns`, `date-fns-tz`
    - Install dev: `@types/bcryptjs`, `vitest`, `@vitejs/plugin-react`, `fast-check`, `@testing-library/react`, `@testing-library/jest-dom`
    - Add scripts: `dev`, `build`, `start`, `lint`, `test`, `test:watch`, `db:migrate`, `db:seed`, `db:generate`
    - _Requirements: 12.7, 14.6_

  - [x] 1.6 Create shared TypeScript types and constants
    - Create `src/types/index.ts` with SessionData, ActionResult<T>, ErrorCode, and all interface types from design (IAIProvider, ActaGenerationInput, ActaGenerationResult, ISequenceService, SequenceResult, IDocumentGenerator, ActaDocxData, GeneratedDocument, IFileStorage, StorageResult, FileMetadata, IAuditLogger, AuditEntry, AuditAction)
    - Create `src/lib/utils/constants.ts` with allowed file extensions, MIME type mappings, max file count (20), pagination defaults, committee prefixes, and role permissions
    - _Requirements: 7.2, 5.3, 10.1_

  - [x] 1.7 Create environment variable validation module
    - Create `src/lib/env.ts` that validates required env vars (DATABASE_URL, SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD, ADMIN_EMAIL) at startup using Zod
    - Throw descriptive error naming the missing variable if any required var is absent
    - Export typed env object for use across the app
    - _Requirements: 14.7_

- [x] 2. Database - Conexión Neon, migraciones, y datos semilla
  - [x] 2.1 Configure Prisma client singleton with Neon serverless adapter
    - Create `src/lib/db/prisma.ts` with singleton pattern suitable for serverless (global cache in development, fresh instance in production)
    - Configure `@neondatabase/serverless` adapter for optimized cold starts
    - _Requirements: 12.1, 12.7_

  - [x] 2.2 Generate and apply initial Prisma migration
    - Run `npx prisma migrate dev --name init` to create initial migration
    - Verify all tables, indexes, enums, and constraints are created correctly
    - _Requirements: 12.2, 12.3_

  - [x] 2.3 Create database seed script with idempotent logic
    - Create `prisma/seed.ts` that seeds: committees (Curricular/CUR, Investigación/INV, Decanatura/DEC, Otro/OTR), and initial admin user (from ADMIN_USER, ADMIN_PASSWORD, ADMIN_EMAIL env vars with bcrypt hashed password)
    - Use upsert or findFirst + create pattern to ensure idempotency (no duplicates on re-run)
    - Configure `prisma` section in `package.json` with seed command
    - _Requirements: 12.4, 12.5, 12.6_

  - [ ]* 2.4 Write property test for seed idempotency (Property 27)
    - **Property 27: Seed idempotency**
    - Verify that running seed n times (n ≥ 1) results in constant count of committee and admin records
    - **Validates: Requirements 12.6**

- [x] 3. Checkpoint - Verify project builds and database connects
  - Ensure `npx prisma generate` succeeds, `npm run build` passes with 0 errors, seed runs correctly. Ask the user if questions arise.

- [x] 4. Authentication - iron-session, login/logout, middleware, rate limiting
  - [x] 4.1 Implement iron-session configuration and session helpers
    - Create `src/lib/auth/session.ts` with session options (cookieName: 'gestor_comites_session', secure in production, httpOnly, sameSite lax, maxAge 8 hours)
    - Implement `getSession()`, `createSession(user)`, `destroySession()` helper functions
    - SESSION_SECRET from env (min 32 chars)
    - _Requirements: 2.2, 2.5, 2.6, 13.1_

  - [x] 4.2 Implement login server action with credential validation
    - Create `src/lib/auth/actions.ts` with `loginAction(formData)` server action
    - Validate input with Zod schema (usuario 3-50 chars, contraseña 8-128 chars, cargo required)
    - Query user by usuario, verify active status, check lock status, compare password with bcrypt
    - On success: reset failedAttempts, create session, audit log
    - On failure: increment failedAttempts, check if should lock (>=5), audit log, return generic error
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9_

  - [x] 4.3 Implement logout server action
    - Create logout action that destroys session and redirects to login page
    - Audit log the session destruction event
    - _Requirements: 2.6, 11.3_

  - [x] 4.4 Implement Next.js middleware for session validation and route protection
    - Create `src/middleware.ts` that intercepts all requests to protected routes (/dashboard, /actas, /admin)
    - Decrypt and validate session cookie on every protected request
    - Check session expiry: 30-minute inactivity OR 8-hour absolute limit
    - Update lastActivity timestamp on valid requests
    - Redirect to /login with 401 if session invalid or expired
    - Allow public routes (/, /login) without session
    - _Requirements: 2.5, 2.6, 2.7, 13.9_

  - [x] 4.5 Implement role-based access guard helpers
    - Create `src/lib/auth/guards.ts` with `requireAdmin(session)`, `requireGestor(session)`, `requireAuth(session)` functions
    - Return 403 and redirect to dashboard if role check fails
    - _Requirements: 3.9, 3.10_

  - [x] 4.6 Implement rate limiting (IP-based and user-based)
    - Implement per-user lockout: lock account for 15 minutes after 5 consecutive failures (stored in User.failedAttempts and User.lockedUntil)
    - Implement per-IP blocking: block IP after 5 failed attempts within 15-minute window (using in-memory store or DB counter)
    - _Requirements: 2.8, 13.8_

  - [x] 4.7 Create Zod validation schemas for auth
    - Create `src/lib/validations/auth.schema.ts` with loginSchema (usuario, contraseña, cargo validation rules)
    - _Requirements: 2.1, 13.4_

  - [ ]* 4.8 Write property tests for authentication (Properties 1-6)
    - **Property 1: Session creation contains all required fields**
    - **Property 2: Invalid credentials produce only generic error messages**
    - **Property 3: Session expiry based on time thresholds**
    - **Property 4: Protected routes require valid session**
    - **Property 5: Account lock after consecutive failed attempts**
    - **Property 6: Successful authentication resets failure counter**
    - **Validates: Requirements 2.2, 2.3, 2.5, 2.6, 2.7, 2.8, 2.9, 13.5, 13.9**

- [ ] 5. Landing Page + Dashboard - Páginas públicas y dashboard post-autenticación
  - [x] 5.1 Implement Landing Page (public root route)
    - Create `src/app/(public)/page.tsx` as Server Component
    - Display "Portal Gestión de Comités" title with UCC institutional branding (green accent #00723F, white background, light gray sections)
    - Add descriptive paragraph about managing academic committee minutes for Faculty of Engineering
    - Add "Ingresar al portal" button with link to /login and CSS transition (200-400ms) on hover/focus
    - Add footer: "© Mgtr. Carlos Alberto Figueroa Martínez || Programa Ingeniería Industrial"
    - Ensure responsive layout (desktop 1024px+, tablet 768-1023px, mobile <768px) without horizontal overflow
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 5.2 Implement Login Page with form
    - Create `src/app/(public)/login/page.tsx` with LoginForm client component
    - Form fields: usuario (text, 3-50 chars), contraseña (password, 8-128 chars), cargo (select dropdown)
    - Client-side validation before submission
    - Display generic error messages on failure (no field-specific hints)
    - Show lock message when account is temporarily blocked
    - Call loginAction server action on submit
    - _Requirements: 2.1, 2.3, 2.8_

  - [x] 5.3 Implement Dashboard page with module cards
    - Create `src/app/(protected)/dashboard/page.tsx` as Server Component
    - Display title "Gestor de Comités"
    - Render three module cards: "Gestionar actas" (navigates to /actas), "Gestionar solicitudes" (shows "Módulo en construcción" modal), "Gestionar otras" (shows "Módulo en construcción" modal)
    - Each card with icon, scale transform ≥1.05 on hover, box-shadow with min blur 4px
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8_

  - [x] 5.4 Implement role-based UI elements on Dashboard
    - Show administration button with pulse animation only if user.rol === 'Administrador'
    - Hide administration button for non-admin users
    - Navigation to /admin/usuarios on admin button click
    - _Requirements: 4.5, 4.6, 4.7_

  - [x] 5.5 Create protected layout with session check and navigation
    - Create `src/app/(protected)/layout.tsx` that reads session and passes user info to children
    - Include navigation header with user name, role indicator, and logout button
    - Redirect to /login if session is not valid
    - _Requirements: 2.5, 2.7_

  - [ ]* 5.6 Write property test for role-based UI visibility (Property 11)
    - **Property 11: Role-based UI element visibility**
    - Verify admin button visible iff rol = Administrador; "+Nueva Acta" visible iff rol != Consulta
    - **Validates: Requirements 3.9, 4.5, 4.6, 5.8**

- [x] 6. Checkpoint - Verify auth flow and UI render correctly
  - Ensure login/logout works, session persists, dashboard renders per role, build passes. Ask the user if questions arise.

- [x] 7. User Administration - CRUD usuarios, roles, admin guard
  - [x] 7.1 Implement User service layer
    - Create `src/lib/services/user.service.ts` with functions: listUsers(page, pageSize), createUser(data), updateUser(id, data), toggleUserActive(id, adminId), changeRole(id, newRole, adminId)
    - Enforce last-admin protection: reject deactivation/role-change if it would remove the last active Administrador
    - Reject self-deactivation
    - Hash password with bcrypt (12 salt rounds) on creation
    - _Requirements: 3.1, 3.2, 3.5, 3.6, 3.7_

  - [x] 7.2 Create Zod validation schemas for user management
    - Create `src/lib/validations/user.schema.ts` with createUserSchema and updateUserSchema
    - nombre_completo: 1-100 chars; usuario: 3-50 chars, unique; password: min 8 chars, 1 uppercase, 1 lowercase, 1 number; cargo: 1-100 chars; correo: valid email, max 150 chars; rol: enum of three valid values
    - _Requirements: 3.2, 3.4_

  - [x] 7.3 Implement User administration server actions
    - Create `src/actions/user.actions.ts` with server actions for: listUsers, createUser, updateUser, toggleActive, changeRole
    - Each action validates admin role via guard, validates input with Zod, calls service, returns ActionResult<T>
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.7, 3.9_

  - [x] 7.4 Implement User Admin page and components
    - Create `src/app/(protected)/admin/usuarios/page.tsx` (Server Component) that calls requireAdmin guard
    - Create `src/components/admin/UserTable.tsx` (Client) displaying paginated user list (20 per page, sorted alphabetically by nombre_completo) with columns: nombre completo, usuario, cargo, rol, correo, estado
    - Create `src/components/admin/UserFormModal.tsx` (Client) for create/edit user form
    - Add activate/deactivate toggle per user row
    - Return 403 + redirect for non-admin access
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.7, 3.9, 3.10_

  - [ ]* 7.5 Write property tests for user validation (Properties 7-10)
    - **Property 7: User input validation consistency**
    - **Property 8: Duplicate username rejection**
    - **Property 9: Last administrator protection invariant**
    - **Property 10: Deactivated users cannot authenticate**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.6, 3.8**

- [x] 8. Actas Module Read - Lista, filtros, paginación, badges de estado
  - [x] 8.1 Implement Acta service layer (read operations)
    - Create `src/lib/services/acta.service.ts` with functions: listActas(filters, page, pageSize), getActaById(id), getActaWithAttachments(id)
    - Support filters: número de acta (partial match), fecha desde/hasta, tipo comité, estado
    - Default sort: fecha_generacion DESC; pagination: 10 per page
    - _Requirements: 5.2, 5.3_

  - [x] 8.2 Implement Actas list page and table component
    - Create `src/app/(protected)/actas/page.tsx` as Server Component
    - Display title "Gestión de Actas de Comité" and description
    - Create `src/components/actas/ActaTable.tsx` (Client) with columns: estado badge, número acta, fecha generación, tipo comité, área/programa, usuario que generó, estado texto, acciones
    - Max 10 rows per page
    - _Requirements: 5.1, 5.3_

  - [x] 8.3 Implement filters and pagination components
    - Create `src/components/actas/ActaFilters.tsx` (Client) with: número acta (text, max 20 chars), fecha desde (date picker), fecha hasta (date picker), tipo comité (dropdown), estado (dropdown), "Buscar" button, "Limpiar filtros" button
    - Create `src/components/ui/Pagination.tsx` reusable pagination component
    - Show "No se encontraron resultados" message when no actas match filters
    - _Requirements: 5.2, 5.9_

  - [x] 8.4 Implement StatusBadge component with color mapping
    - Create `src/components/ui/StatusBadge.tsx` with color-coded badges: Borrador→gray, Generada→green, Descargada→blue, Error_generacion→red, En_procesamiento→orange
    - _Requirements: 5.4_

  - [x] 8.5 Implement action buttons with role-based visibility
    - Action buttons per row: ver detalle, descargar, consultar soportes, ver estado
    - Show "reintentar generación" only when estado = Error_generacion
    - Hide "+Nueva Acta", "reintentar", and "descargar" for Consulta role
    - _Requirements: 5.5, 5.6, 5.7, 5.8_

  - [ ]* 8.6 Write property tests for acta list (Properties 12-13)
    - **Property 12: Acta list pagination and sort order**
    - **Property 13: Status badge color mapping**
    - **Validates: Requirements 5.3, 5.4**

- [x] 9. Acta Form + Validation - Formulario modal, tabla asistentes, validación
  - [x] 9.1 Create Zod validation schemas for acta form
    - Create `src/lib/validations/acta.schema.ts` with actaFormSchema
    - tipoComite: enum (Curricular, Investigación, Decanatura, Otro); areaPrograma: enum; ordenDia: max 1200 chars, required; asistentes: array min 1, max 50 entries, each with nombre (max 150) and cargo (max 100) non-empty; proyecto: max 150 chars; reviso: max 150 chars; copia: optional max 300 chars
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_

  - [x] 9.2 Implement ActaFormModal component
    - Create `src/components/actas/ActaFormModal.tsx` (Client) with fields: fecha (non-editable, current date dd/mm/yyyy America/Bogota), tipo comité (select), área/programa (select), orden del día (textarea with character counter, max 1200, line break support, placeholder), asistentes table (editable, add/remove rows), proyectó (default: user's nombre completo, editable, max 150), revisó (text, max 150), copia (optional, max 300)
    - Client-side validation per field with error highlighting
    - On valid submit: call server action, close modal, show success confirmation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x] 9.3 Implement attendees editable table component
    - Create `src/components/forms/AttendeesTable.tsx` (Client) with columns: nombre completo (max 150), cargo (max 100)
    - Allow add row, remove row, edit existing rows
    - Maximum 50 rows, minimum 1 row required on submission
    - Validate each row has non-empty nombre and cargo
    - _Requirements: 6.5, 6.9_

  - [x] 9.4 Implement acta creation server action
    - Create `src/actions/acta.actions.ts` with `createActaAction(formData)` server action
    - Validate with Zod, sanitize inputs, call sequence service, call AI generation, call document generation
    - Set estado to En_procesamiento during generation, then Generada on success or Error_generacion on failure
    - Audit log the creation
    - _Requirements: 6.10, 8.7, 9.5_

  - [ ]* 9.5 Write property test for form validation (Property 14)
    - **Property 14: Form field validation enforcement**
    - Verify submission prevented when required fields empty, ordenDia > 1200, asistentes < 1 or > 50, empty attendee fields
    - **Validates: Requirements 6.4, 6.5, 6.9**

- [x] 10. Checkpoint - Verify actas module displays and form validates
  - Ensure actas list renders, filters work, form validates inputs, role-based visibility correct. Ask the user if questions arise.

- [x] 11. File Upload - Attachment manager, validación, almacenamiento
  - [x] 11.1 Create file validation schema and utilities
    - Create `src/lib/validations/file.schema.ts` with file validation rules
    - Create `src/lib/utils/sanitize.ts` with `sanitizeFilename()` function: allow only alphanumeric, hyphens, underscores, dots; remove path traversal sequences (../, ..\) and special characters
    - Implement MIME type detection and extension matching validation
    - _Requirements: 7.2, 7.3, 7.8, 7.9, 13.4, 13.6_

  - [x] 11.2 Implement file storage service with local/Vercel Blob abstraction
    - Create `src/lib/services/file-storage.service.ts` implementing IFileStorage interface
    - Create `LocalFileStorage` class: stores files in `/uploads` directory (dev mode)
    - Create `VercelBlobStorage` class: uses @vercel/blob SDK (production mode)
    - Factory function selects based on STORAGE_PROVIDER env var
    - Store files outside public directory, serve only through authenticated API route
    - _Requirements: 7.1, 13.7_

  - [x] 11.3 Implement AttachmentManager component
    - Create `src/components/actas/AttachmentManager.tsx` (Client) allowing multiple file uploads (max 20 files per acta)
    - Display attachment table with columns: nombre, tipo, tamaño, estado de carga, estado de procesamiento, fecha, acciones
    - Actions per file: eliminar (with confirmation prompt), reemplazar, descargar/ver, ver estado
    - Show blocking spinner during upload: "Por favor espere, estamos cargando los soportes..."
    - Prevent form submission while upload in progress
    - Show per-file error messages on failure without affecting other files
    - _Requirements: 7.1, 7.4, 7.5, 7.6, 7.7, 7.10_

  - [x] 11.4 Implement file upload server action with full validation pipeline
    - Create `src/actions/file.actions.ts` with `uploadFileAction(formData)` and `deleteFileAction(id)`
    - Validation pipeline: check extension allowlist → sanitize filename → verify MIME matches extension → check size vs MAX_FILE_SIZE_MB
    - On validation failure: reject file with specific error, keep other files unchanged
    - On success: store file, create Attachment record in DB
    - _Requirements: 7.2, 7.3, 7.6, 7.7, 7.8, 7.9, 13.6_

  - [x] 11.5 Implement authenticated file serving API route
    - Create `src/app/api/files/[id]/route.ts` that verifies session, fetches file metadata from DB, streams file from storage
    - Return 401 if no valid session
    - Return 404 if file not found
    - _Requirements: 13.7_

  - [ ]* 11.6 Write property tests for file handling (Properties 15-18)
    - **Property 15: File extension allowlist enforcement**
    - **Property 16: File size limit enforcement**
    - **Property 17: Content-type and extension mismatch detection**
    - **Property 18: File name sanitization**
    - **Validates: Requirements 7.2, 7.3, 7.8, 7.9**

- [x] 12. Sequential Numbering - Servicio de secuencias con seguridad de concurrencia
  - [x] 12.1 Implement Sequence Service with transactional locking
    - Create `src/lib/services/sequence.service.ts` implementing ISequenceService
    - Use `SELECT ... FOR UPDATE` within Prisma $transaction for row-level locking
    - For new year/committee combination: create row with lastNumber = 1
    - For existing: increment lastNumber
    - Format: ACTA-{PREFIX}-{YEAR}-{0-padded 4-digit SEQ}
    - Year determined from America/Bogota timezone
    - Reject if lastNumber >= 9999 (SEQUENCE_EXHAUSTED error)
    - Retry up to 3 times on lock contention with exponential backoff (50ms, 100ms, 200ms)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ]* 12.2 Write property tests for sequential numbering (Properties 23-25)
    - **Property 23: Sequence number format and independence**
    - **Property 24: New year sequence initialization**
    - **Property 25: Sequence uniqueness under concurrency**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**

- [x] 13. AI Integration - Provider interface, extracción de texto, fallback
  - [x] 13.1 Implement AI provider interface and factory
    - Create `src/lib/services/ai/provider.interface.ts` with IAIProvider interface
    - Create `src/lib/services/ai/factory.ts` with `createAIProvider()` that reads AI_PROVIDER env var
    - Return OpenAIProvider for 'openai', AnthropicProvider for 'anthropic', FallbackProvider for empty/unset
    - _Requirements: 8.5, 14.5_

  - [x] 13.2 Implement OpenAI provider
    - Create `src/lib/services/ai/openai.provider.ts` implementing IAIProvider
    - Install `openai` SDK
    - Generate formal academic content structured by agenda points
    - Include timeout handling (5 minute max)
    - `isAvailable()` checks API key exists and service responds
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 13.3 Implement Anthropic provider
    - Create `src/lib/services/ai/anthropic.provider.ts` implementing IAIProvider
    - Install `@anthropic-ai/sdk`
    - Same interface contract as OpenAI provider
    - Timeout and availability check
    - _Requirements: 8.1, 8.2, 8.5_

  - [x] 13.4 Implement deterministic fallback provider
    - Create `src/lib/services/ai/fallback.provider.ts` implementing IAIProvider
    - Generate structured content using only form data (no API calls)
    - List agenda points as sections with neutral template language: "Se revisó el punto [X] del orden del día."
    - Include attendee information formatted
    - Always returns success, `isAvailable()` always true
    - _Requirements: 8.3, 8.6, 14.5_

  - [x] 13.5 Implement text extraction utilities
    - Install `pdf-parse`, `mammoth`, `xlsx` libraries
    - Create text extractors: PDF (pdf-parse), DOCX (mammoth), XLSX (xlsx cell extraction), TXT/CSV (buffer to string)
    - For image/audio/video files: set estadoProcesamiento to 'no_soportado', textoExtraido remains null
    - _Requirements: 8.1, 8.10_

  - [x] 13.6 Implement AI generation orchestration with fallback logic
    - Create main generation function that: extracts text from attachments, builds prompt with form data + extracted text, calls primary AI provider, falls back to FallbackProvider on error/timeout
    - Set 5-minute timeout; if exceeded, use fallback strategy
    - If both primary and fallback fail: set Estado_Acta to Error_generacion, audit log error
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [ ]* 13.7 Write property tests for AI integration (Properties 19-20, 29)
    - **Property 19: AI fallback on provider failure**
    - **Property 20: Media files accepted but content not extracted**
    - **Property 29: AI factory fallback selection**
    - **Validates: Requirements 8.6, 8.10, 14.5**

- [x] 14. Checkpoint - Verify AI generation and file upload pipeline
  - Ensure file upload validates correctly, AI fallback works when no provider configured, sequence generation produces correct format. Ask the user if questions arise.

- [x] 15. Document Generation - docxtemplater, template replacement, download
  - [x] 15.1 Implement Document Generator service
    - Create `src/lib/services/document.service.ts` implementing IDocumentGenerator
    - Load institutional template from `templates/` directory using PizZip
    - Use docxtemplater to replace placeholders: {{NUMERO_ACTA}}, {{CIUDAD_FECHA}}, {{HORA}}, {{LUGAR}}, {{ASISTENTES}}, {{ORDEN_DIA}}, {{DESARROLLO}}, {{PROYECTO}}, {{REVISO}}, {{COPIA}}
    - Substitute empty string for unavailable placeholder values
    - Preserve original template formatting (headers, margins, tables, styles, signatures)
    - Generate output buffer
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 15.2 Implement output filename generation
    - Generate filename: ACTA-{PREFIX}-{YEAR}-{SEQ}-Comite-{TYPE}-{PROGRAM}.docx
    - PREFIX from committee code (CUR, INV, DEC, OTR)
    - SEQ zero-padded 4 digits
    - Example: ACTA-CUR-2026-0001-Comite-Curricular-Ingenieria-Industrial.docx
    - _Requirements: 9.4_

  - [x] 15.3 Implement document download API route
    - Create or extend API route for document download
    - Verify session authentication before serving
    - On download: update Estado_Acta to 'Descargada', audit log download (user, filename, timestamp)
    - Stream file with correct Content-Type and Content-Disposition headers
    - _Requirements: 9.5, 9.6_

  - [x] 15.4 Wire document generation into acta creation flow
    - After AI generates desarrollo, call document generator with full ActaDocxData
    - Store generated .docx via file storage service
    - Update Acta record with docxPath, docxFilename, estado = Generada
    - If generation fails (missing/corrupted template): show error message, keep estado unchanged
    - _Requirements: 9.5, 9.7_

  - [ ]* 15.5 Write property tests for document generation (Properties 21-22)
    - **Property 21: Template placeholder replacement completeness**
    - **Property 22: Output filename format compliance**
    - **Validates: Requirements 9.2, 9.4**

- [ ] 16. Audit + Testing + Deploy - Auditoría, testing final, despliegue Vercel
  - [x] 16.1 Implement Audit Logger service
    - Create `src/lib/services/audit.service.ts` implementing IAuditLogger
    - Fire-and-forget pattern: `log()` method returns void immediately, processes async
    - In-memory queue with background processing
    - Retry up to 3 times on DB write failure (100ms linear backoff)
    - Fallback to console.error with [AUDIT_FALLBACK] prefix if all retries fail
    - Write-only: no update/delete operations on audit_logs
    - Non-blocking: adds <100ms latency to primary operations
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 16.2 Wire audit logging into all auditable actions
    - Integrate audit logging into: login success/failure, session create/expire, acta create/update/delete, file upload/delete, document download/generate, user create/update/deactivate
    - Each entry includes: userId (if authenticated), action type, entity type, entity id, timestamp (America/Bogota), IP address, metadata_json with action-specific context
    - _Requirements: 11.1, 11.2, 11.3_

  - [ ]* 16.3 Write property test for audit logging (Property 26)
    - **Property 26: Audit entry creation for all auditable actions**
    - Verify that for every auditable action type, an audit_log entry is created with all required fields
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [x] 16.4 Implement input sanitization utility and integrate
    - Complete `src/lib/utils/sanitize.ts` with `sanitizeInput()` function
    - Remove/escape: HTML tags, script content, SQL metacharacters outside ORM context, path traversal sequences
    - Integrate sanitization into all server actions before Zod validation
    - _Requirements: 13.4, 13.5_

  - [ ]* 16.5 Write property tests for sanitization and env validation (Properties 28, 30)
    - **Property 28: Input sanitization removes dangerous content**
    - **Property 30: Missing required environment variable detection**
    - **Validates: Requirements 13.4, 14.7**

  - [x] 16.6 Create README.md with complete project documentation
    - Sections: project description, tech stack, setup instructions, environment variables (with descriptions), database setup (Neon), AI provider configuration, Word template setup, file upload limitations on Vercel, deployment steps
    - _Requirements: 14.3_

  - [x] 16.7 Final build verification and deployment preparation
    - Ensure `npm run build` passes with zero errors
    - Verify all environment variables documented in .env.example
    - Verify .gitignore excludes all sensitive files
    - Prepare for Vercel deployment: GitHub repo "gestor-comites-ucc", Vercel project under "carlos-figueroas-projects-77a0a373"
    - _Requirements: 14.1, 14.2, 14.6_

- [x] 17. Final Checkpoint - Full system verification
  - Ensure all tests pass, build succeeds with 0 errors, all modules integrated correctly. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major phases
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- This is a NEW independent project in C:\DesarrollosCF\Gestor_Comites - no existing project dependencies
- AuthAdminKit patterns are adapted/copied, not imported as runtime dependency
- No hardcoded secrets anywhere - all via environment variables
- Deployment (Phase 12/Task 16.7) is the LAST step after full validation
- All work occurs within this project directory only

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.5"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.6", "1.7"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["2.2"] },
    { "id": 5, "tasks": ["2.3", "2.4"] },
    { "id": 6, "tasks": ["4.1", "4.7"] },
    { "id": 7, "tasks": ["4.2", "4.3", "4.5", "4.6"] },
    { "id": 8, "tasks": ["4.4", "4.8"] },
    { "id": 9, "tasks": ["5.1", "5.2", "5.5"] },
    { "id": 10, "tasks": ["5.3", "5.4", "5.6"] },
    { "id": 11, "tasks": ["7.1", "7.2"] },
    { "id": 12, "tasks": ["7.3", "7.4", "7.5"] },
    { "id": 13, "tasks": ["8.1", "9.1"] },
    { "id": 14, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 15, "tasks": ["8.5", "8.6", "9.2", "9.3"] },
    { "id": 16, "tasks": ["9.4", "9.5"] },
    { "id": 17, "tasks": ["11.1", "11.2"] },
    { "id": 18, "tasks": ["11.3", "11.4", "11.5"] },
    { "id": 19, "tasks": ["11.6", "12.1"] },
    { "id": 20, "tasks": ["12.2", "13.1"] },
    { "id": 21, "tasks": ["13.2", "13.3", "13.4", "13.5"] },
    { "id": 22, "tasks": ["13.6", "13.7"] },
    { "id": 23, "tasks": ["15.1", "15.2"] },
    { "id": 24, "tasks": ["15.3", "15.4", "15.5"] },
    { "id": 25, "tasks": ["16.1", "16.4"] },
    { "id": 26, "tasks": ["16.2", "16.3", "16.5"] },
    { "id": 27, "tasks": ["16.6", "16.7"] }
  ]
}
```
