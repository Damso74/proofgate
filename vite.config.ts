import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Chemins relatifs : le build sert aussi bien à la racine d'un domaine qu'en
  // sous-dossier (GitHub Pages, Cloudflare Pages, nginx, S3…).
  base: "./",
  build: { outDir: "dist", sourcemap: false, target: "es2022" },
});
