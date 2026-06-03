import { z } from "zod";

/**
 * Schema for environment variable validation.
 * Required variables throw descriptive errors if missing.
 * Optional variables have defaults or are allowed to be undefined.
 */
const envSchema = z.object({
  // Required variables
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

  // Optional variables
  AI_PROVIDER: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STORAGE_PROVIDER: z.string().default("local"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables at startup.
 * Throws a descriptive error naming the missing or invalid variable.
 */
function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(firstIssue.message);
  }

  return result.data;
}

/**
 * Validated and typed environment variables.
 * Importing this module triggers validation — if a required variable is missing,
 * the application will fail to start with a descriptive error message.
 */
export const env: Env = validateEnv();
