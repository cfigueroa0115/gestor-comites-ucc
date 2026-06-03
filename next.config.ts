import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
