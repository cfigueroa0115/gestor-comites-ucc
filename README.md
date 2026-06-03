# Portal Gestión de Comités

Sistema web institucional para la gestión de actas de comités académicos de la **Universidad Cooperativa de Colombia**, Facultad de Ingeniería. Permite generar documentos formales en formato Word (.docx) con apoyo de inteligencia artificial, gestionar archivos adjuntos, numeración secuencial y trazabilidad completa mediante auditoría.

**Autor:** Mgtr. Carlos Alberto Figueroa Martínez — Programa Ingeniería Industrial

---

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 16 (App Router, Server Components & Actions) |
| Lenguaje | TypeScript 5 |
| Estilos | Tailwind CSS v4 |
| Base de Datos | PostgreSQL (Neon Serverless) |
| ORM | Prisma 7 con `@prisma/adapter-neon` |
| Sesiones | iron-session (cookies cifradas, stateless) |
| Generación DOCX | docxtemplater + PizZip |
| Almacenamiento | Vercel Blob (producción) / local (desarrollo) |
| IA | OpenAI / Anthropic (configurable) con fallback determinístico |
| Validación | Zod |
| Testing | Vitest + Testing Library + fast-check (PBT) |
| Despliegue | Vercel |

---

## Configuración del Entorno Local

### Prerrequisitos

- Node.js 18+ (recomendado 20 LTS)
- npm 9+
- Cuenta en [Neon](https://neon.tech) (base de datos PostgreSQL)
- (Opcional) Clave de API de OpenAI o Anthropic para generación con IA

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/cfigueroa0115/gestor-comites-ucc.git
cd gestor-comites-ucc

# 2. Instalar dependencias
npm install

# 3. Copiar variables de entorno
cp .env.example .env.local

# 4. Editar .env.local con valores reales (ver sección Variables de Entorno)

# 5. Generar el cliente Prisma
npx prisma generate

# 6. Ejecutar migraciones en la base de datos
npx prisma migrate deploy

# 7. Poblar datos iniciales (seed)
npx prisma db seed

# 8. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

### Scripts Disponibles

| Script | Descripción |
|--------|------------|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción |
| `npm run start` | Iniciar servidor en modo producción |
| `npm run lint` | Ejecutar ESLint |
| `npm run test` | Ejecutar tests con Vitest |
| `npm run test:watch` | Tests en modo watch |
| `npm run db:migrate` | Crear/aplicar migraciones de desarrollo |
| `npm run db:seed` | Ejecutar seed de datos iniciales |
| `npm run db:generate` | Regenerar cliente Prisma |

---

## Variables de Entorno

Crear un archivo `.env.local` basado en `.env.example`. A continuación se describen todas las variables:

### Base de Datos (Neon PostgreSQL)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DATABASE_URL` | ✅ | Connection string de Neon PostgreSQL. Formato: `postgresql://user:password@host/database?sslmode=require` |

### Seguridad de Sesión

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `SESSION_SECRET` | ✅ | Clave secreta para cifrar cookies de sesión iron-session. Mínimo 32 caracteres. Generar con: `openssl rand -base64 32` |

### Usuario Administrador Inicial

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `ADMIN_USER` | ✅ | Nombre de usuario del administrador inicial (usado en el seed) |
| `ADMIN_PASSWORD` | ✅ | Contraseña del administrador (mín. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número) |
| `ADMIN_EMAIL` | ✅ | Correo electrónico del administrador inicial |

### Configuración de IA

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `AI_PROVIDER` | ❌ | Proveedor de IA: `"openai"`, `"anthropic"`, o vacío `""` para modo fallback sin IA |
| `AI_API_KEY` | ❌* | Clave de API del proveedor configurado. *Requerida solo si `AI_PROVIDER` tiene valor |
| `AI_MODEL` | ❌ | Modelo a utilizar (ej: `"gpt-4o"`, `"claude-sonnet-4-20250514"`). Por defecto: `"gpt-4o"` |

> **Nota:** Si `AI_PROVIDER` está vacío o no definido, el sistema funciona normalmente usando generación estructurada determinística (sin llamadas a APIs externas de IA).

### Carga de Archivos

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `MAX_FILE_SIZE_MB` | ❌ | Tamaño máximo de archivos adjuntos en MB. Por defecto: `10` |

### Almacenamiento de Archivos

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `STORAGE_PROVIDER` | ❌ | Proveedor de almacenamiento: `"local"` (desarrollo) o `"vercel-blob"` (producción). Por defecto: `"local"` |
| `BLOB_READ_WRITE_TOKEN` | ❌* | Token de lectura/escritura de Vercel Blob. *Requerido solo cuando `STORAGE_PROVIDER=vercel-blob` |

---

## Base de Datos (Neon PostgreSQL)

El proyecto utiliza [Neon](https://neon.tech) como servicio de PostgreSQL serverless, con el proyecto **SQL_GestorComites**.

### Configuración de Neon

1. Crear una cuenta en [neon.tech](https://neon.tech)
2. Crear un proyecto nuevo (nombre sugerido: `SQL_GestorComites`)
3. Copiar el connection string del dashboard de Neon
4. Asignar el connection string a `DATABASE_URL` en `.env.local`

El formato del connection string es:
```
postgresql://<usuario>:<contraseña>@<host>.neon.tech/<database>?sslmode=require
```

### Migraciones

```bash
# Desarrollo: crear nueva migración
npx prisma migrate dev --name nombre_descriptivo

# Producción: aplicar migraciones pendientes
npx prisma migrate deploy
```

### Seed (Datos Iniciales)

El seed crea:
- Tipos de comité: Curricular (CUR), Investigación (INV), Decanatura (DEC), Otro (OTR)
- Usuario administrador inicial (usando variables `ADMIN_USER`, `ADMIN_PASSWORD`, `ADMIN_EMAIL`)

```bash
npx prisma db seed
```

El seed es idempotente: ejecutarlo múltiples veces no genera duplicados.

### Prisma Studio (opcional)

Para explorar la base de datos visualmente:
```bash
npx prisma studio
```

---

## Configuración del Proveedor de IA

El sistema soporta múltiples proveedores de IA mediante un patrón Strategy:

### OpenAI

```env
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
AI_MODEL="gpt-4o"
```

### Anthropic

```env
AI_PROVIDER="anthropic"
AI_API_KEY="sk-ant-..."
AI_MODEL="claude-sonnet-4-20250514"
```

### Modo Fallback (sin IA)

```env
AI_PROVIDER=""
```

En modo fallback, el sistema genera actas con estructura formal usando únicamente los datos del formulario y la información extraída de los archivos adjuntos, sin requerir conexión a servicios externos de IA.

### Comportamiento ante errores

Si el proveedor de IA configurado no está disponible o retorna un error durante la generación de un acta, el sistema automáticamente recurre al modo fallback para completar la generación sin interrumpir al usuario.

---

## Plantilla Word (Template DOCX)

El sistema genera documentos Word (.docx) a partir de una plantilla institucional con placeholders.

### Ubicación

La plantilla debe ubicarse en:
```
templates/acta-comite-curricular-ing-industrial.docx
```

### Placeholders Soportados

| Placeholder | Contenido |
|-------------|-----------|
| `{{NUMERO_ACTA}}` | Número secuencial del acta (ej: ACTA-CUR-2026-0001) |
| `{{CIUDAD_FECHA}}` | Ciudad y fecha de generación |
| `{{HORA}}` | Hora de la sesión |
| `{{LUGAR}}` | Lugar de la sesión |
| `{{ASISTENTES}}` | Tabla de asistentes (nombre y cargo) |
| `{{ORDEN_DIA}}` | Puntos del orden del día |
| `{{DESARROLLO}}` | Contenido generado (desarrollo de la sesión) |
| `{{PROYECTO}}` | Nombre de quien proyecta |
| `{{REVISO}}` | Nombre de quien revisa |
| `{{COPIA}}` | Destinatarios de copia |

### Creación de la Plantilla

El proyecto incluye un script auxiliar para crear la plantilla:

```bash
npx tsx scripts/create-template.ts
```

> **Importante:** La plantilla debe mantener el formato institucional de la UCC. El sistema preserva headers, márgenes, tablas, estilos y secciones de firma del documento original.

---

## Limitaciones de Carga de Archivos en Vercel

Vercel impone un **límite de 4.5 MB** en el body de las solicitudes HTTP en sus funciones serverless. Esto afecta directamente la carga de archivos adjuntos.

### Solución Implementada

El proyecto utiliza **Vercel Blob** para almacenamiento de archivos en producción:

- Los archivos se suben directamente a Vercel Blob, evitando el límite del body de las funciones serverless
- La metadata del archivo (nombre, tipo, tamaño, ruta) se almacena en la base de datos
- Los archivos se sirven mediante rutas API autenticadas

### Configuración en Producción

```env
STORAGE_PROVIDER="vercel-blob"
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
```

Para obtener el token:
1. En el dashboard de Vercel, ir a **Storage** → **Create** → **Blob**
2. Conectar el store al proyecto
3. El token `BLOB_READ_WRITE_TOKEN` se agrega automáticamente al proyecto

### Configuración en Desarrollo

```env
STORAGE_PROVIDER="local"
```

En modo local, los archivos se almacenan en el sistema de archivos del servidor (directorio temporal).

### Tipos de Archivo Permitidos

`.docx`, `.doc`, `.pdf`, `.xlsx`, `.xls`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.mp3`, `.mp4`, `.wav`, `.avi`, `.txt`, `.csv`, `.pptx`

### Límite de Tamaño

Configurable mediante `MAX_FILE_SIZE_MB` (por defecto: 10 MB). Máximo 20 archivos por acta.

---

## Despliegue en Vercel

### Prerrequisitos

- Cuenta de Vercel (proyecto: `carlos-figueroas-projects-77a0a373`)
- Repositorio GitHub: `github.com/cfigueroa0115/gestor-comites-ucc`
- Base de datos Neon configurada y con migraciones aplicadas

### Pasos de Despliegue

#### 1. Preparar el repositorio

```bash
# Verificar que el build pasa sin errores
npm run build

# Commit y push al repositorio
git add .
git commit -m "Ready for deployment"
git push origin main
```

#### 2. Conectar con Vercel

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Importar el repositorio `gestor-comites-ucc` desde GitHub
3. Seleccionar el framework preset: **Next.js**
4. Configurar las variables de entorno (ver paso 3)
5. Click en **Deploy**

#### 3. Configurar Variables de Entorno en Vercel

En el dashboard de Vercel → Proyecto → **Settings** → **Environment Variables**, agregar:

| Variable | Entorno | Notas |
|----------|---------|-------|
| `DATABASE_URL` | Production, Preview | Connection string de Neon |
| `SESSION_SECRET` | Production, Preview | Generar valor único para producción |
| `ADMIN_USER` | Production | Usuario admin inicial |
| `ADMIN_PASSWORD` | Production | Contraseña admin inicial |
| `ADMIN_EMAIL` | Production | Email admin inicial |
| `AI_PROVIDER` | Production, Preview | `"openai"` o `"anthropic"` o vacío |
| `AI_API_KEY` | Production, Preview | Clave del proveedor de IA |
| `AI_MODEL` | Production, Preview | Modelo a utilizar |
| `MAX_FILE_SIZE_MB` | Production, Preview | `"10"` (recomendado) |
| `STORAGE_PROVIDER` | Production | `"vercel-blob"` |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview | Token de Vercel Blob |

#### 4. Configurar Vercel Blob Storage

1. En Vercel Dashboard → **Storage** → **Create Database**
2. Seleccionar **Blob**
3. Conectar al proyecto
4. El token se añade automáticamente como variable de entorno

#### 5. Ejecutar Migraciones en Producción

Después del primer despliegue, ejecutar las migraciones contra la base de datos de producción:

```bash
# Usando la DATABASE_URL de producción
DATABASE_URL="postgresql://..." npx prisma migrate deploy
DATABASE_URL="postgresql://..." npx prisma db seed
```

#### 6. Verificar el Despliegue

1. Acceder a la URL de producción proporcionada por Vercel
2. Verificar que la landing page carga correctamente
3. Iniciar sesión con las credenciales del administrador
4. Confirmar acceso al dashboard y módulos

### Despliegues Automáticos

Una vez conectado, Vercel despliega automáticamente:
- **Producción:** al hacer push a la rama `main`
- **Preview:** al crear pull requests

---

## Estructura del Proyecto

```
gestor-comites/
├── src/
│   ├── app/                    # Rutas Next.js (App Router)
│   │   ├── (public)/           # Rutas públicas (landing, login)
│   │   ├── (protected)/        # Rutas protegidas (dashboard, actas, admin)
│   │   └── api/                # Route handlers (API)
│   ├── actions/                # Server Actions
│   ├── components/             # Componentes React
│   │   ├── ui/                 # Primitivas UI reutilizables
│   │   ├── forms/              # Componentes de formulario
│   │   ├── actas/              # Componentes del módulo de actas
│   │   └── admin/              # Componentes de administración
│   ├── lib/                    # Lógica de negocio y utilidades
│   │   ├── auth/               # Autenticación y sesiones
│   │   ├── services/           # Servicios (AI, documentos, archivos, auditoría)
│   │   ├── db/                 # Cliente Prisma
│   │   ├── validations/        # Schemas Zod
│   │   └── utils/              # Utilidades (fechas, sanitización, constantes)
│   └── types/                  # Tipos TypeScript compartidos
├── prisma/                     # Schema, migraciones y seed
├── templates/                  # Plantilla Word institucional
├── public/                     # Activos estáticos
├── scripts/                    # Scripts de utilidad
└── .env.example                # Template de variables de entorno
```

---

## Roles del Sistema

| Rol | Permisos |
|-----|----------|
| **Administrador** | Acceso total: gestión de usuarios, actas, configuración |
| **Usuario_Gestor** | Crear y gestionar actas, subir archivos, descargar documentos |
| **Consulta** | Solo lectura: ver actas y soportes |

---

## Licencia

Proyecto institucional de la Universidad Cooperativa de Colombia, Facultad de Ingeniería.

© Mgtr. Carlos Alberto Figueroa Martínez — Programa Ingeniería Industrial
