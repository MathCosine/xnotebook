import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base + hash routing means the build works from any sub-path,
// e.g. https://<you>.github.io/xnotebook/ on GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
