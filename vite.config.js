import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" keeps asset paths relative so the build works at
// https://<user>.github.io/<repo>/ without knowing the repo name.
export default defineConfig({ plugins: [react()], base: "./" });
