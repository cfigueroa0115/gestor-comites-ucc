import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration for Portal Gestión de Comités
 * UCC Institutional Colors and Design System
 *
 * Note: With Tailwind CSS v4, theme customization is primarily done in
 * src/app/globals.css using @theme. This file provides additional
 * configuration for plugins and content paths.
 */
const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ucc: {
          green: "#00723F",
          "green-dark": "#005A32",
          "green-light": "#E6F4ED",
          white: "#FFFFFF",
          gray: "#F5F5F5",
          "gray-dark": "#E0E0E0",
          gold: "#F5A623",
          blue: "#4A90D9",
          red: "#DC2626",
          orange: "#F97316",
        },
      },
      borderRadius: {
        institutional: "8px",
      },
      boxShadow: {
        card: "0 2px 4px rgba(0, 0, 0, 0.1)",
        "card-hover": "0 4px 8px rgba(0, 0, 0, 0.15)",
      },
      transitionDuration: {
        "300": "300ms",
      },
    },
  },
  plugins: [],
};

export default config;
