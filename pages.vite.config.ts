import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: "pages",
  base: "/fantasy-efl-dashboard/",
  publicDir: "../public",
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  build: { rolldownOptions: { input: { main: fileURLToPath(new URL("./pages/index.html", import.meta.url)), personal: fileURLToPath(new URL("./pages/personal.html", import.meta.url)) } }, outDir: "../pages-dist", emptyOutDir: true },
});
