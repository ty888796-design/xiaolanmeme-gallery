import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths allow the same build to work on both user and project Pages.
  base: "./",
  plugins: [react()],
});
