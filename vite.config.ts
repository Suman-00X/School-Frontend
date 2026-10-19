import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

/* The dev server proxies the backend, so the browser sees one origin.
   /files/signed serves uploaded files (logo, documents) when the backend stores them on local disk;
   run the backend with APP_URL=http://localhost:5173 so its signed links point here. */
const backend = process.env.VITE_API_PROXY ?? "http://127.0.0.1:3000";
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: backend, changeOrigin: true },
      "/files/signed": { target: backend, changeOrigin: true }
    }
  }
});
