-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('Administrador', 'Usuario_Gestor', 'Consulta');

-- CreateEnum
CREATE TYPE "EstadoActa" AS ENUM ('Borrador', 'Generada', 'Descargada', 'Error_generacion', 'En_procesamiento');

-- CreateEnum
CREATE TYPE "EstadoCarga" AS ENUM ('pendiente', 'subiendo', 'completado', 'error');

-- CreateEnum
CREATE TYPE "EstadoProcesamiento" AS ENUM ('pendiente', 'procesando', 'completado', 'error', 'no_soportado');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nombre_completo" VARCHAR(100) NOT NULL,
    "usuario" VARCHAR(50) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "cargo" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'Consulta',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "committees" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "codigo" VARCHAR(10) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "committees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actas" (
    "id" TEXT NOT NULL,
    "numero_acta" TEXT NOT NULL,
    "secuencia" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL,
    "ciudad" VARCHAR(100) NOT NULL DEFAULT 'Bogotá D.C.',
    "hora_inicio" VARCHAR(10),
    "hora_fin" VARCHAR(10),
    "lugar" VARCHAR(200),
    "tipo_comite" VARCHAR(50) NOT NULL,
    "area_programa" VARCHAR(100) NOT NULL,
    "orden_dia" TEXT NOT NULL,
    "asistentes_json" JSONB NOT NULL,
    "desarrollo_generado" TEXT,
    "presidente_nombre" VARCHAR(150),
    "presidente_cargo" VARCHAR(100),
    "elaborado_por_usuario_id" TEXT NOT NULL,
    "elaborado_por_nombre" VARCHAR(150) NOT NULL,
    "elaborado_por_cargo" VARCHAR(100) NOT NULL,
    "copia" VARCHAR(300),
    "proyecto" VARCHAR(150) NOT NULL,
    "reviso" VARCHAR(150) NOT NULL,
    "estado" "EstadoActa" NOT NULL DEFAULT 'Borrador',
    "docx_path" TEXT,
    "docx_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "actas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "acta_id" TEXT NOT NULL,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "tipo_mime" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "estado_carga" "EstadoCarga" NOT NULL DEFAULT 'pendiente',
    "estado_procesamiento" "EstadoProcesamiento" NOT NULL DEFAULT 'pendiente',
    "texto_extraido" TEXT,
    "error_procesamiento" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "metadata_json" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sequences" (
    "id" TEXT NOT NULL,
    "committee_code" VARCHAR(10) NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_usuario_key" ON "users"("usuario");

-- CreateIndex
CREATE UNIQUE INDEX "committees_codigo_key" ON "committees"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "actas_numero_acta_key" ON "actas"("numero_acta");

-- CreateIndex
CREATE INDEX "actas_tipo_comite_anio_idx" ON "actas"("tipo_comite", "anio");

-- CreateIndex
CREATE INDEX "actas_estado_idx" ON "actas"("estado");

-- CreateIndex
CREATE INDEX "actas_fecha_generacion_idx" ON "actas"("fecha_generacion");

-- CreateIndex
CREATE INDEX "attachments_acta_id_idx" ON "attachments"("acta_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sequences_committee_code_year_key" ON "sequences"("committee_code", "year");

-- AddForeignKey
ALTER TABLE "actas" ADD CONSTRAINT "actas_elaborado_por_usuario_id_fkey" FOREIGN KEY ("elaborado_por_usuario_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_acta_id_fkey" FOREIGN KEY ("acta_id") REFERENCES "actas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
