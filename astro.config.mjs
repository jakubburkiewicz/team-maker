// @ts-check
import { defineConfig, envField } from "astro/config";

import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
  output: "server",
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      optimizeDeps: {
        // `astro:env/server` (src/lib/supabase.ts) is a virtual module, so Vite's dependency
        // scanner cannot see that it pulls in `astro/env/runtime`. On a cold cache Vite discovers
        // it on the first request, re-optimizes `deps_ssr` and reloads — and the in-flight request
        // renders React islands with two copies of React ("Invalid hook call").
        include: ["astro/env/runtime"],
      },
    },
  },
  adapter: cloudflare(),
  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret", optional: true }),
      SUPABASE_KEY: envField.string({ context: "server", access: "secret", optional: true }),
    },
  },
});
