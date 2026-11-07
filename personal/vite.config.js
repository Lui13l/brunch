import process from "node:process";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// El backend de Brunch (brunch/backend). Se cambia con API_TARGET en .env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const API = env.API_TARGET || "http://localhost:3000";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      // Escucha en toda la red: el personal entra desde su celular por el WiFi.
      host: true,
      proxy: {
        "/api": { target: API, changeOrigin: true },
        "/ws": { target: API, ws: true, changeOrigin: true },
      },
    },
  };
});
