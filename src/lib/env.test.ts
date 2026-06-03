import { describe, it, expect } from "vitest";
import { z } from "zod";

/**
 * We test the env validation logic by re-creating the schema inline,
 * since importing env.ts directly would trigger validation immediately
 * against the actual process.env.
 */
const envSchema = z.object({
  DATABASE_URL: z
    .string({ error: "Missing required environment variable: DATABASE_URL" })
    .min(1, "Missing required environment variable: DATABASE_URL"),
  SESSION_SECRET: z
    .string({ error: "Missing required environment variable: SESSION_SECRET" })
    .min(32, "Environment variable SESSION_SECRET must be at least 32 characters"),
  ADMIN_USER: z
    .string({ error: "Missing required environment variable: ADMIN_USER" })
    .min(1, "Missing required environment variable: ADMIN_USER"),
  ADMIN_PASSWORD: z
    .string({ error: "Missing required environment variable: ADMIN_PASSWORD" })
    .min(1, "Missing required environment variable: ADMIN_PASSWORD"),
  ADMIN_EMAIL: z
    .string({ error: "Missing required environment variable: ADMIN_EMAIL" })
    .min(1, "Missing required environment variable: ADMIN_EMAIL"),
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STORAGE_PROVIDER: z.string().default("local"),
});

function validateEnv(env: Record<string, string | undefined>) {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(firstIssue.message);
  }
  return result.data;
}

const validEnv = {
  DATABASE_URL: "postgresql://user:pass@host:5432/db",
  SESSION_SECRET: "a-very-long-secret-that-is-at-least-32-chars-ok",
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "AdminPass123",
  ADMIN_EMAIL: "admin@ucc.edu.co",
};

describe("env validation", () => {
  describe("valid environment", () => {
    it("should pass with all required variables set", () => {
      const result = validateEnv(validEnv);
      expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
      expect(result.SESSION_SECRET).toBe(validEnv.SESSION_SECRET);
      expect(result.ADMIN_USER).toBe(validEnv.ADMIN_USER);
      expect(result.ADMIN_PASSWORD).toBe(validEnv.ADMIN_PASSWORD);
      expect(result.ADMIN_EMAIL).toBe(validEnv.ADMIN_EMAIL);
    });

    it("should set defaults for optional variables", () => {
      const result = validateEnv(validEnv);
      expect(result.MAX_FILE_SIZE_MB).toBe(10);
      expect(result.STORAGE_PROVIDER).toBe("local");
      expect(result.AI_PROVIDER).toBeUndefined();
      expect(result.AI_API_KEY).toBeUndefined();
      expect(result.AI_MODEL).toBeUndefined();
      expect(result.BLOB_READ_WRITE_TOKEN).toBeUndefined();
    });

    it("should accept optional variables when provided", () => {
      const result = validateEnv({
        ...validEnv,
        AI_PROVIDER: "openai",
        AI_API_KEY: "sk-test-key",
        AI_MODEL: "gpt-4",
        MAX_FILE_SIZE_MB: "25",
        BLOB_READ_WRITE_TOKEN: "vercel_blob_token",
        STORAGE_PROVIDER: "vercel-blob",
      });
      expect(result.AI_PROVIDER).toBe("openai");
      expect(result.AI_API_KEY).toBe("sk-test-key");
      expect(result.AI_MODEL).toBe("gpt-4");
      expect(result.MAX_FILE_SIZE_MB).toBe(25);
      expect(result.BLOB_READ_WRITE_TOKEN).toBe("vercel_blob_token");
      expect(result.STORAGE_PROVIDER).toBe("vercel-blob");
    });
  });

  describe("missing required variables", () => {
    it("should throw descriptive error when DATABASE_URL is missing", () => {
      const { DATABASE_URL, ...rest } = validEnv;
      expect(() => validateEnv(rest)).toThrow(
        "Missing required environment variable: DATABASE_URL"
      );
    });

    it("should throw descriptive error when SESSION_SECRET is missing", () => {
      const { SESSION_SECRET, ...rest } = validEnv;
      expect(() => validateEnv(rest)).toThrow(
        "Missing required environment variable: SESSION_SECRET"
      );
    });

    it("should throw descriptive error when ADMIN_USER is missing", () => {
      const { ADMIN_USER, ...rest } = validEnv;
      expect(() => validateEnv(rest)).toThrow(
        "Missing required environment variable: ADMIN_USER"
      );
    });

    it("should throw descriptive error when ADMIN_PASSWORD is missing", () => {
      const { ADMIN_PASSWORD, ...rest } = validEnv;
      expect(() => validateEnv(rest)).toThrow(
        "Missing required environment variable: ADMIN_PASSWORD"
      );
    });

    it("should throw descriptive error when ADMIN_EMAIL is missing", () => {
      const { ADMIN_EMAIL, ...rest } = validEnv;
      expect(() => validateEnv(rest)).toThrow(
        "Missing required environment variable: ADMIN_EMAIL"
      );
    });
  });

  describe("empty string values for required variables", () => {
    it("should throw when DATABASE_URL is empty string", () => {
      expect(() => validateEnv({ ...validEnv, DATABASE_URL: "" })).toThrow(
        "Missing required environment variable: DATABASE_URL"
      );
    });

    it("should throw when ADMIN_USER is empty string", () => {
      expect(() => validateEnv({ ...validEnv, ADMIN_USER: "" })).toThrow(
        "Missing required environment variable: ADMIN_USER"
      );
    });
  });

  describe("SESSION_SECRET minimum length", () => {
    it("should throw when SESSION_SECRET is less than 32 characters", () => {
      expect(() =>
        validateEnv({ ...validEnv, SESSION_SECRET: "short" })
      ).toThrow(
        "Environment variable SESSION_SECRET must be at least 32 characters"
      );
    });

    it("should accept SESSION_SECRET with exactly 32 characters", () => {
      const secret32 = "a".repeat(32);
      const result = validateEnv({ ...validEnv, SESSION_SECRET: secret32 });
      expect(result.SESSION_SECRET).toBe(secret32);
    });
  });

  describe("MAX_FILE_SIZE_MB coercion", () => {
    it("should coerce string number to number", () => {
      const result = validateEnv({ ...validEnv, MAX_FILE_SIZE_MB: "50" });
      expect(result.MAX_FILE_SIZE_MB).toBe(50);
    });

    it("should use default of 10 when not provided", () => {
      const result = validateEnv(validEnv);
      expect(result.MAX_FILE_SIZE_MB).toBe(10);
    });
  });
});
