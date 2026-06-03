# Requirements Document

## Introduction

Portal Gestión de Comités es un sistema web institucional para la Universidad Cooperativa de Colombia (UCC), Facultad de Ingeniería. El portal permite gestionar actas de comités académicos, incluyendo la generación de documentos formales en formato Word (.docx) con apoyo de inteligencia artificial, gestión de archivos adjuntos, numeración secuencial y trazabilidad completa mediante auditoría. El sistema se despliega sobre Next.js con PostgreSQL (Neon) en Vercel.

## Glossary

- **Portal**: La aplicación web completa "Portal Gestión de Comités"
- **Landing_Page**: Página de inicio pública institucional del Portal
- **Auth_Module**: Módulo de autenticación adaptado de AuthAdminKit para validar credenciales y gestionar sesiones
- **Session**: Registro activo que almacena ID de usuario, nombre completo, usuario, cargo, rol, correo y fecha/hora de ingreso
- **User_Admin_Module**: Módulo para administrar usuarios del sistema (crear, editar, activar/desactivar, cambiar rol)
- **Dashboard**: Microportal post-autenticación que muestra tarjetas de módulos disponibles
- **Actas_Module**: Módulo de gestión de actas de comité académico
- **Acta**: Documento formal de acta de comité que registra asistentes, orden del día y desarrollo de la sesión
- **Acta_Form**: Formulario modal para capturar los datos necesarios para generar una nueva acta
- **Attachment_Manager**: Componente para subir, visualizar y administrar archivos adjuntos (soportes) asociados a un acta
- **AgenteGeneradorActas**: Agente de inteligencia artificial que interpreta documentos adjuntos y genera contenido formal del acta
- **Doc_Generator**: Componente que genera documentos Word (.docx) editables a partir de plantillas institucionales
- **Sequence_Service**: Servicio transaccional que genera números secuenciales únicos por año y tipo de comité
- **Audit_Logger**: Servicio que registra todas las acciones del sistema en la tabla audit_logs
- **Administrador**: Rol con acceso total al sistema incluyendo administración de usuarios
- **Usuario_Gestor**: Rol con permisos para crear y gestionar actas
- **Consulta**: Rol con permisos de solo lectura sobre actas generadas
- **Comité_Curricular**: Tipo de comité con prefijo CUR
- **Comité_Investigación**: Tipo de comité con prefijo INV
- **Comité_Decanatura**: Tipo de comité con prefijo DEC
- **Comité_Otro**: Tipo de comité con prefijo OTR
- **Template_Docx**: Archivo plantilla Word institucional con placeholders para generación de actas
- **Estado_Acta**: Estado del ciclo de vida de un acta: Borrador, Generada, Descargada, Error_generación, En_procesamiento

## Requirements

### Requirement 1: Landing Page Institucional

**User Story:** Como visitante del portal, quiero ver una página de inicio con diseño institucional de la UCC, para identificar claramente el sistema y acceder al portal.

#### Acceptance Criteria

1. THE Landing_Page SHALL be publicly accessible without authentication and SHALL display the title "Portal Gestión de Comités" with UCC institutional branding including green accent color, white background, and light gray sections
2. THE Landing_Page SHALL display a descriptive paragraph that mentions the system's purpose of managing academic committee minutes ("actas de comités académicos") and identifies the Faculty of Engineering as the target audience
3. WHEN the visitor clicks the "Ingresar al portal" button, THE Landing_Page SHALL navigate to the Auth_Module login page within 1 second
4. THE Landing_Page SHALL display a footer containing "© Mgtr. Carlos Alberto Figueroa Martínez || Programa Ingeniería Industrial"
5. THE Landing_Page SHALL render on desktop (1024px and above), tablet (768px to 1023px), and mobile (below 768px) viewports without horizontal overflow, without text truncation, and with all interactive elements reachable without horizontal scrolling
6. THE Landing_Page SHALL include CSS transitions with duration between 200ms and 400ms on the "Ingresar al portal" button and any other clickable elements when hovered or focused

### Requirement 2: Autenticación de Usuarios

**User Story:** Como usuario del sistema, quiero autenticarme con mis credenciales, para acceder a las funcionalidades protegidas según mi rol.

#### Acceptance Criteria

1. THE Auth_Module SHALL present a login form requesting usuario (text input, 3 to 50 characters), contraseña (password input, 8 to 128 characters), and cargo (selectable from cargos registered in the database)
2. WHEN a user submits credentials where usuario, contraseña, and cargo all match a registered active user record in the database, THE Auth_Module SHALL create a Session containing user ID, nombre completo, usuario, cargo, rol, correo, and fecha/hora de ingreso in America/Bogota timezone
3. WHEN a user submits credentials where usuario, contraseña, or cargo do not match a registered active user record, THE Auth_Module SHALL display a generic error message indicating that the credentials are invalid without revealing which specific field was incorrect
4. THE Auth_Module SHALL store passwords using a secure hashing algorithm (bcrypt with minimum 10 salt rounds or argon2)
5. THE Auth_Module SHALL validate the Session on every request to a protected route before granting access
6. WHEN a Session has been inactive for more than 30 minutes or exceeds 8 hours since creation, THE Auth_Module SHALL invalidate the Session and redirect the user to the login page
7. IF a user attempts to access a protected route without a valid Session, THEN THE Auth_Module SHALL return HTTP 401 and redirect to the login page
8. IF a user fails authentication 5 consecutive times for the same usuario, THEN THE Auth_Module SHALL temporarily lock that account for 15 minutes and display a message indicating the account is temporarily locked
9. WHEN a user successfully authenticates, THE Auth_Module SHALL reset the failed login attempt counter for that usuario to zero

### Requirement 3: Administración de Usuarios

**User Story:** Como Administrador, quiero gestionar las cuentas de usuario del sistema, para controlar quién tiene acceso y con qué permisos.

#### Acceptance Criteria

1. THE User_Admin_Module SHALL display a paginated list of all registered users showing nombre completo, usuario, cargo, rol, correo, and estado (activo/inactivo), with a maximum of 20 users per page, sorted alphabetically by nombre completo
2. THE User_Admin_Module SHALL allow the Administrador to create a new user providing: nombre completo (máximo 100 caracteres), usuario (máximo 50 caracteres, único), contraseña (mínimo 8 caracteres, al menos una mayúscula, una minúscula, y un número), cargo (máximo 100 caracteres), rol (Administrador, Usuario_Gestor, or Consulta), and correo (formato válido de email, máximo 150 caracteres), where all fields are required
3. IF the Administrador attempts to create a user with a usuario that already exists, THEN THE User_Admin_Module SHALL reject the creation and display an error message indicating the username is already taken
4. THE User_Admin_Module SHALL allow the Administrador to edit an existing user's nombre completo, cargo, rol, and correo, applying the same validation rules as creation
5. THE User_Admin_Module SHALL allow the Administrador to activate or deactivate a user account
6. IF the Administrador attempts to deactivate their own account or the last active Administrador account, THEN THE User_Admin_Module SHALL reject the operation and display an error message indicating the action is not permitted
7. THE User_Admin_Module SHALL allow the Administrador to change a user's rol to Administrador, Usuario_Gestor, or Consulta
8. WHILE a user account is deactivated, THE Auth_Module SHALL reject login attempts for that account with a message indicating the account is inactive
9. THE User_Admin_Module SHALL be accessible only to users with the Administrador role
10. IF a non-Administrador user attempts to access the User_Admin_Module, THEN THE Portal SHALL return HTTP 403 and redirect to the Dashboard

### Requirement 4: Dashboard / Microportal

**User Story:** Como usuario autenticado, quiero ver un panel con los módulos disponibles, para navegar a la funcionalidad que necesito.

#### Acceptance Criteria

1. WHEN authentication succeeds, THE Dashboard SHALL display the title "Gestor de Comités" within 2 seconds of navigation to the dashboard view
2. THE Dashboard SHALL display three module cards with the following titles and descriptions: "Gestionar actas" - "Genere, consulte, descargue y controle el estado de las actas de comité", "Gestionar solicitudes" - "Administre solicitudes asociadas a los diferentes comités académicos", "Gestionar otras" - "Acceda a funcionalidades complementarias de gestión y seguimiento"
3. WHEN the user clicks the "Gestionar actas" card, THE Dashboard SHALL navigate to the Actas_Module
4. WHEN the user clicks "Gestionar solicitudes" or "Gestionar otras", THE Dashboard SHALL display a modal with the message "Módulo en construcción" and a visible close button that dismisses the modal when clicked
5. IF the authenticated user has the Administrador role, THEN THE Dashboard SHALL display an administration button with a repeating pulse animation
6. IF the authenticated user does not have the Administrador role, THEN THE Dashboard SHALL NOT display the administration button
7. WHEN the Administrador clicks the administration button, THE Dashboard SHALL navigate to the User_Admin_Module
8. THE Dashboard SHALL render each module card with an icon, a scale transform of no less than 1.05 on hover, and a box-shadow with a minimum blur radius of 4px

### Requirement 5: Módulo de Gestión de Actas

**User Story:** Como Usuario_Gestor, quiero ver y filtrar las actas generadas, para gestionar los registros de comités académicos.

#### Acceptance Criteria

1. THE Actas_Module SHALL display the title "Gestión de Actas de Comité" and the description "Consulte, genere y administre las actas de los comités académicos con trazabilidad documental e inteligencia artificial aplicada."
2. THE Actas_Module SHALL provide search filters for: número de acta (text input, maximum 20 characters), fecha desde (date picker), fecha hasta (date picker), tipo de comité (dropdown), and estado (dropdown), along with a "Buscar" button to apply filters and a "Limpiar filtros" button to reset all filter fields to their default empty values and reload unfiltered results.
3. THE Actas_Module SHALL display a paginated table with columns: estado visual (badge), número acta, fecha generación, tipo comité, área/programa, usuario que generó, estado texto, and acciones, showing a maximum of 10 rows per page, sorted by fecha generación in descending order by default.
4. THE Actas_Module SHALL display the Estado_Acta using color-coded visual badges: Borrador (gray), Generada (green), Descargada (blue), Error_generación (red), En_procesamiento (orange).
5. THE Actas_Module SHALL provide action buttons per row: ver detalle, descargar, consultar soportes, and ver estado.
6. IF the Estado_Acta of a row is Error_generación, THEN THE Actas_Module SHALL display an additional "reintentar generación" action button for that row.
7. THE Actas_Module SHALL display a "+ Nueva Acta" button that opens the Acta_Form modal.
8. WHILE the user's rol is Consulta, THE Actas_Module SHALL hide the "+ Nueva Acta" button and the action buttons "reintentar generación" and "descargar", displaying only "ver detalle", "consultar soportes", and "ver estado" as available actions.
9. IF no actas match the applied filters, THEN THE Actas_Module SHALL display a message indicating that no results were found for the selected criteria.

### Requirement 6: Formulario de Nueva Acta

**User Story:** Como Usuario_Gestor, quiero completar un formulario con los datos del comité, para generar una nueva acta formal.

#### Acceptance Criteria

1. THE Acta_Form SHALL display the current date in dd/mm/yyyy format using America/Bogota timezone as a non-editable field
2. THE Acta_Form SHALL require selection of comité type from options: Curricular, Investigación, Decanatura, Otro
3. THE Acta_Form SHALL require selection of área/programa from options: Ingeniería Industrial, Ingeniería Electrónica, Ingeniería Ambiental
4. THE Acta_Form SHALL require an "Orden del día" text field with a maximum of 1200 characters, a visible character counter, support for line breaks, and placeholder text "Liste los puntos del orden del día que serán tratados en el comité."
5. THE Acta_Form SHALL require an "Asistentes" editable table with columns nombre completo (maximum 150 characters) and cargo (maximum 100 characters), allowing the user to add, remove, and edit rows up to a maximum of 50 rows, with a minimum of 1 row required on submission
6. THE Acta_Form SHALL require a "Proyectó" field (maximum 150 characters) defaulting to the authenticated user's nombre completo, editable by the user
7. THE Acta_Form SHALL require a "Revisó" text field with a maximum of 150 characters
8. THE Acta_Form SHALL provide an optional "Copia" text field with a maximum of 300 characters
9. IF the user submits the Acta_Form with any required field empty or with any Asistentes row having nombre completo or cargo empty, THEN THE Acta_Form SHALL highlight the invalid fields, display a validation message per field indicating the missing information, and prevent submission
10. WHEN the user submits the Acta_Form with all required fields valid, THEN THE Acta_Form SHALL generate the acta, close the form, and display a success confirmation message within 3 seconds

### Requirement 7: Gestión de Archivos Adjuntos (Soportes)

**User Story:** Como Usuario_Gestor, quiero adjuntar archivos de soporte al acta, para que el agente de IA pueda interpretar la información y generar el contenido formal.

#### Acceptance Criteria

1. THE Attachment_Manager SHALL allow uploading multiple files within the Acta_Form modal, up to a maximum of 20 files per acta
2. THE Attachment_Manager SHALL accept files of types: .docx, .doc, .pdf, .xlsx, .xls, .png, .jpg, .jpeg, .gif, .mp3, .mp4, .wav, .avi, .txt, .csv, and .pptx
3. IF a file exceeds the size limit defined by the MAX_FILE_SIZE_MB environment variable, THEN THE Attachment_Manager SHALL reject the file, display an error message indicating the file name and the maximum allowed size in MB, and retain all other previously uploaded files unchanged
4. THE Attachment_Manager SHALL display an attachment table with columns: nombre, tipo, tamaño, estado de carga, estado de procesamiento, fecha, and acciones
5. THE Attachment_Manager SHALL provide actions per attachment: eliminar, reemplazar, descargar/ver, and ver estado de procesamiento
6. WHILE a file upload is in progress, THE Attachment_Manager SHALL display a blocking spinner with the message "Por favor espere, estamos cargando los soportes. No cierre esta ventana ni interrumpa el proceso." and prevent form submission until the upload completes or fails
7. IF a file upload fails, THEN THE Attachment_Manager SHALL display an error message specific to the failed file indicating the file name and failure reason, without affecting other uploaded files
8. IF the detected content type of an uploaded file does not match its declared file extension, THEN THE Attachment_Manager SHALL reject the file and display an error message indicating a content-type mismatch for that file name
9. THE Attachment_Manager SHALL sanitize file names by allowing only alphanumeric characters, hyphens, underscores, and dots, and removing all other characters including path traversal sequences before storage
10. WHEN the Usuario_Gestor selects the eliminar action on an attachment, THE Attachment_Manager SHALL display a confirmation prompt before proceeding with deletion

### Requirement 8: Generación de Actas con Inteligencia Artificial

**User Story:** Como Usuario_Gestor, quiero que el sistema genere automáticamente el contenido formal del acta interpretando los documentos adjuntos, para obtener un acta profesional sin redactar manualmente.

#### Acceptance Criteria

1. WHEN the user triggers acta generation, THE AgenteGeneradorActas SHALL extract text content from attached files of types PDF, Word (.docx, .doc), TXT, and Excel (.xlsx, .xls) within 5 minutes of processing time
2. THE AgenteGeneradorActas SHALL generate formal academic minute content structured according to the Acta_Form agenda points, using only information present in the Acta_Form data and extracted attachment content
3. IF the extracted content is insufficient to elaborate on a specific agenda point, THEN THE AgenteGeneradorActas SHALL include neutral placeholder language acknowledging the point was reviewed without fabricating details
4. THE AgenteGeneradorActas SHALL not include any information that is not present in the form data or attached documents
5. THE AgenteGeneradorActas SHALL use the AI provider configured via AI_PROVIDER, AI_API_KEY, and AI_MODEL environment variables
6. IF the AI provider is unavailable or returns an error, THEN THE AgenteGeneradorActas SHALL fall back to structured generation using only the Acta_Form data without AI enhancement
7. WHILE the AgenteGeneradorActas is processing, THE Portal SHALL set the Estado_Acta to En_procesamiento and display a blocking spinner with the message indicating that the acta is being generated with AI support and may take several minutes depending on attachment size
8. IF the AgenteGeneradorActas does not complete processing within 5 minutes, THEN THE Portal SHALL treat the operation as failed and apply the fallback generation strategy
9. IF the AgenteGeneradorActas fails after the fallback attempt, THEN THE Portal SHALL set the Estado_Acta to Error_generación and log the error details in the Audit_Logger
10. WHEN the user attaches image files (.png, .jpg, .jpeg) or audio/video files (.mp3, .mp4, .wav, .avi), THE AgenteGeneradorActas SHALL accept the files without error and register them as attachments, but SHALL NOT extract content from them until OCR or transcription capabilities are integrated

### Requirement 9: Generación de Documento Word (.docx)

**User Story:** Como Usuario_Gestor, quiero descargar el acta generada como documento Word editable con formato institucional, para poder revisarla y firmarla.

#### Acceptance Criteria

1. THE Doc_Generator SHALL use the institutional template file (acta-comite-curricular-ing-industrial.docx) copied into the project without modifying the original source file in its storage location
2. THE Doc_Generator SHALL replace placeholders in the template: {{NUMERO_ACTA}}, {{CIUDAD_FECHA}}, {{HORA}}, {{LUGAR}}, {{ASISTENTES}}, {{ORDEN_DIA}}, {{DESARROLLO}}, {{PROYECTO}}, {{REVISO}}, and {{COPIA}}, and SHALL substitute an empty string for any placeholder whose value is not available at generation time
3. THE Doc_Generator SHALL preserve the template's formatting such that the generated document retains identical headers, margins, tables, styles, and signature sections as the template and remains fully editable when opened in Microsoft Word
4. THE Doc_Generator SHALL generate the output filename using the format: ACTA-{PREFIX}-{YEAR}-{SEQ}-Comite-{TYPE}-{PROGRAM}.docx where SEQ is a zero-padded 4-digit sequential number starting at 0001 per calendar year (example: ACTA-CUR-2026-0001-Comite-Curricular-Ingenieria-Industrial.docx)
5. WHEN the Doc_Generator produces an output file with size greater than 0 bytes and no processing errors, THE Portal SHALL set the Estado_Acta to Generada
6. WHEN the user downloads the generated document, THE Portal SHALL set the Estado_Acta to Descargada and log the download in the Audit_Logger including the user identifier, document filename, and timestamp
7. IF the Doc_Generator fails to produce the document due to a missing template, corrupted template, or processing error, THEN THE Portal SHALL display an error message indicating the generation failure reason and SHALL keep the Estado_Acta unchanged

### Requirement 10: Numeración Secuencial de Actas

**User Story:** Como administrador del sistema, quiero que las actas tengan numeración secuencial única por año y tipo de comité, para mantener un registro ordenado y sin duplicados.

#### Acceptance Criteria

1. THE Sequence_Service SHALL generate sequential numbers in the format ACTA-{PREFIX}-{YEAR}-{SEQUENCE} where PREFIX is one of CUR, INV, DEC, OTR, YEAR is the four-digit calendar year determined from the generation timestamp in America/Bogota timezone, and SEQUENCE is a zero-padded four-digit number starting at 0001
2. THE Sequence_Service SHALL maintain independent sequence counters segmented by year and committee type, so that each combination of year and committee type (CUR, INV, DEC, OTR) has its own counter
3. WHEN the first number for a given committee type is requested in a new calendar year (America/Bogota timezone), THE Sequence_Service SHALL start that committee type's sequence at 0001 for the new year
4. THE Sequence_Service SHALL guarantee that no two actas within the same year and committee type receive the same sequence number, even under concurrent access
5. IF the Sequence_Service detects a concurrency conflict (lock contention or unique constraint violation) during number generation, THEN THE Sequence_Service SHALL retry the operation up to 3 times before returning an error indicating that sequence generation failed
6. IF the sequence counter for a given year and committee type reaches 9999, THEN THE Sequence_Service SHALL reject the next generation request and return an error indicating that the sequence capacity for that year and committee type has been exhausted

### Requirement 11: Auditoría y Trazabilidad

**User Story:** Como Administrador, quiero que todas las acciones queden registradas con trazabilidad completa, para poder auditar el uso del sistema.

#### Acceptance Criteria

1. WHEN a user performs a create, update, delete, download, or generation action, THE Audit_Logger SHALL record an audit entry containing: user ID, action type, entity type, entity ID, timestamp in America/Bogota timezone, IP address, and a metadata_json field capturing action-specific context (e.g., changed fields for updates, filename for downloads)
2. WHEN a login attempt fails, THE Audit_Logger SHALL record an audit entry containing: attempted username, timestamp in America/Bogota timezone, and IP address
3. WHEN a session is created or expires, THE Audit_Logger SHALL record an audit entry containing: user ID, event type (creation or expiration), timestamp in America/Bogota timezone, and IP address
4. THE Audit_Logger SHALL store audit records in the audit_logs table with write-only access (no update or delete operations permitted on audit records)
5. THE Audit_Logger SHALL execute asynchronously such that audit logging adds no more than 100 milliseconds of latency to the primary user operation response time
6. IF the audit logging mechanism fails to persist a record (due to queue overflow, database unavailability, or other error), THEN THE Audit_Logger SHALL retry the write up to 3 times and, if still unsuccessful, persist the failed entry to a fallback store without interrupting the primary user operation

### Requirement 12: Base de Datos PostgreSQL

**User Story:** Como equipo de desarrollo, quiero una base de datos PostgreSQL bien estructurada en Neon, para almacenar todos los datos del sistema de forma segura y eficiente.

#### Acceptance Criteria

1. THE Portal SHALL use a PostgreSQL database hosted on Neon with the project name SQL_GestorComites, connected via the DATABASE_URL environment variable
2. THE Portal SHALL define the following tables with their complete schemas as specified in the data model: users (id, nombre_completo, usuario, password_hash, cargo, correo, rol, activo, created_at, updated_at), committees (id, nombre, codigo, activo, created_at, updated_at), actas (id, numero_acta, secuencia, anio, fecha_generacion, ciudad, hora_inicio, hora_fin, lugar, tipo_comite, area_programa, orden_dia, asistentes_json, desarrollo_generado, presidente_nombre, presidente_cargo, elaborado_por_usuario_id, elaborado_por_nombre, elaborado_por_cargo, copia, proyecto, reviso, estado, docx_path, docx_filename, created_at, updated_at), attachments (id, acta_id, nombre_archivo, tipo_mime, extension, size_bytes, storage_path, estado_carga, estado_procesamiento, texto_extraido, error_procesamiento, created_at, updated_at), audit_logs (id, user_id, action, entity_type, entity_id, metadata_json, created_at), and sequences (id, committee_code, year, last_number, created_at, updated_at)
3. THE Portal SHALL enforce foreign key constraints between attachments.acta_id and actas.id, between audit_logs.user_id and users.id, and between actas.elaborado_por_usuario_id and users.id
4. THE Portal SHALL include seed data for committee types: Curricular (CUR), Investigación (INV), Decanatura (DEC), Otro (OTR) and for programs: Ingeniería Industrial, Ingeniería Electrónica, Ingeniería Ambiental
5. WHEN the database seed process is executed, THE Portal SHALL create the initial Administrador user with rol set to "Administrador", using the credentials from environment variables ADMIN_USER, ADMIN_PASSWORD, and ADMIN_EMAIL, storing the password as a hashed value in the password_hash column
6. IF the database seed process is executed and the seed data already exists, THEN THE Portal SHALL skip creation of duplicate records without returning an error
7. THE Portal SHALL use an ORM (Prisma or Drizzle) for all database operations with typed schemas that match the defined table structures

### Requirement 13: Seguridad del Sistema

**User Story:** Como responsable del sistema, quiero que el portal cumpla con estándares de seguridad, para proteger la información institucional y los datos de los usuarios.

#### Acceptance Criteria

1. THE Portal SHALL store all secrets (database credentials, API keys, session secrets) exclusively in environment variables
2. THE Portal SHALL not contain hardcoded credentials or secrets in source code or configuration files committed to version control
3. THE Portal SHALL include a .gitignore file that excludes .env, .env.local, node_modules, and any file matching patterns likely to contain credentials (e.g., *.pem, *.key)
4. THE Portal SHALL validate and sanitize all user input on both client and server side before processing, removing or escaping HTML tags, script content, SQL meta-characters handled outside the ORM, and path traversal sequences (../ or ..\)
5. IF user input fails validation or contains potentially malicious content, THEN THE Portal SHALL reject the request and return an error message indicating the input is invalid, without revealing internal system details
6. THE Portal SHALL validate uploaded files by checking file extension against an allowlist of permitted types, verifying MIME type matches the declared extension, and rejecting files that exceed the size limit defined by MAX_FILE_SIZE_MB
7. THE Portal SHALL prevent execution of uploaded files by storing them outside the public directory and serving them exclusively through API routes that verify the requester has an active authenticated session
8. IF a user exceeds 5 failed login attempts from the same IP address within a 15-minute window, THEN THE Portal SHALL block further login attempts from that IP for 15 minutes and return an error message indicating the account is temporarily locked due to excessive attempts
9. IF a Session has been inactive for more than 30 minutes, THEN THE Auth_Module SHALL invalidate the Session and redirect the user to the login page with a message indicating the session has expired
10. THE Portal SHALL include a .env.example file listing all required environment variables (DATABASE_URL, AI_API_KEY, NEXTAUTH_SECRET or SESSION_SECRET, ADMIN_INITIAL_PASSWORD) with placeholder descriptions and no real values

### Requirement 14: Despliegue y Configuración

**User Story:** Como equipo de desarrollo, quiero que el proyecto se despliegue correctamente en Vercel con toda la configuración documentada, para facilitar la operación y mantenimiento.

#### Acceptance Criteria

1. THE Portal SHALL be deployed as a new Vercel project under the account "carlos-figueroas-projects-77a0a373" without overwriting or modifying existing Vercel deployments
2. THE Portal SHALL use a new GitHub repository named "gestor-comites-ucc" under the account github.com/cfigueroa0115
3. THE Portal SHALL include a README.md file containing the following sections: project description, tech stack, setup instructions, environment variables list with descriptions, database setup (Neon), AI provider configuration, Word template setup, file upload limitations on Vercel, and deployment steps
4. THE Portal SHALL define all configurable parameters as environment variables: MAX_FILE_SIZE_MB, AI_PROVIDER, AI_API_KEY, AI_MODEL, DATABASE_URL, SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD, ADMIN_EMAIL
5. IF AI_PROVIDER environment variable is unset or empty, THEN THE Portal SHALL start successfully and generate documents using the fallback structured generation mode without requiring an external AI service
6. THE Portal SHALL pass the build command "next build" with zero errors before deployment to Vercel
7. IF a required environment variable (DATABASE_URL, SESSION_SECRET, ADMIN_USER, ADMIN_PASSWORD, or ADMIN_EMAIL) is not set at startup, THEN THE Portal SHALL fail to start and display an error message indicating which environment variable is missing

### Requirement 15: Diseño UX/UI Institucional

**User Story:** Como usuario del portal, quiero una interfaz profesional con diseño institucional de la UCC, para tener una experiencia visual coherente y agradable.

#### Acceptance Criteria

1. THE Portal SHALL use the institutional UCC color palette: green (#00723F) as primary accent, white (#FFFFFF) as background, light gray (#F5F5F5) for sections, gold/orange (#F5A623) for warnings, and soft blue (#4A90D9) for informational elements
2. THE Portal SHALL render all pages on viewports from 320px to 1920px width without horizontal scrollbars, without content truncation, and with all interactive elements reachable and operable via responsive design techniques
3. THE Portal SHALL use rounded borders (minimum 8px border-radius), box-shadows with no more than 4px blur and 10% opacity, and consistent spacing based on an 8px grid system across all components
4. IF an asynchronous operation exceeds 300ms without completing, THEN THE Portal SHALL display an animated loading indicator until the operation completes or fails
5. WHEN the user hovers over, focuses on, or taps an interactive element (button, card, or link), THE Portal SHALL provide a visible state change (color shift, elevation change, or scale transform) within 100ms using CSS transitions
6. THE Portal SHALL display text using a minimum of three hierarchical levels (heading, subheading, body) with a minimum contrast ratio of 4.5:1 against the background, a base body font size of at least 16px, and a clear size differentiation of at least 4px between each level
7. WHEN the user opens or closes a modal, THE Portal SHALL animate the modal with a fade and scale transition lasting between 200ms and 400ms

### Requirement 16: Aislamiento del Proyecto

**User Story:** Como equipo de desarrollo, quiero que este proyecto esté completamente aislado de proyectos existentes, para evitar efectos secundarios o modificaciones no deseadas.

#### Acceptance Criteria

1. THE Portal SHALL be developed in a new independent directory separate from all existing projects
2. THE Portal SHALL not modify, import from, or write to the AuthAdminKit source project
3. THE Portal SHALL not modify, import from, or write to the existing Portal de Gestión de Estudiantes deployed at gestor-estudiantes-ucc.vercel.app
4. THE Portal SHALL copy and adapt authentication patterns from AuthAdminKit into its own codebase as independent implementations with no runtime dependency on the original source
5. THE Portal SHALL maintain its own independent package.json, configuration files, GitHub repository (gestor-comites-ucc), and Vercel deployment pipeline
