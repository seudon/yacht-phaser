import { defineConfig } from "vite"

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/yacht-phaser/" : "/",
  server: {
    host: "0.0.0.0",
  },
})
