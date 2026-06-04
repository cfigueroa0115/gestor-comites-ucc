-- CreateTable
CREATE TABLE "voice_transcriptions" (
    "id" TEXT NOT NULL,
    "acta_id" TEXT,
    "session_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "duracion" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_transcriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_transcriptions_session_id_idx" ON "voice_transcriptions"("session_id");

-- CreateIndex
CREATE INDEX "voice_transcriptions_created_at_idx" ON "voice_transcriptions"("created_at");
