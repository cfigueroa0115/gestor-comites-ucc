import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Prisma Client singleton configured with the Neon serverless adapter.
 *
 * - In development: caches the instance on `globalThis` to avoid
 *   re-instantiation during hot module reload (HMR).
 * - In production: creates a fresh instance per cold start (serverless).
 *
 * The @neondatabase/serverless adapter uses WebSocket connections
 * optimized for serverless environments like Vercel, reducing cold start
 * latency compared to traditional TCP-based PostgreSQL drivers.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. Cannot initialize Prisma Client."
    );
  }

  const adapter = new PrismaNeon({ connectionString });

  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
