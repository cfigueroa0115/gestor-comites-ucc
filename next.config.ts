import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Attachments are sent to Server Actions for text extraction.
      // Default limit is 1MB; Vercel caps request bodies at 4.5MB.
      bodySizeLimit: '4mb',
    },
  },
  // Include template files in the serverless function bundle
  outputFileTracingIncludes: {
    '/api/**': ['./templates/**'],
    '/actas/**': ['./templates/**'],
    '/dashboard/**': ['./templates/**'],
  },
  // Configure security headers for all routes.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
      ],
    },
  ],
};

export default nextConfig;
