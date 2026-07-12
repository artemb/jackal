import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/ws": {
        target: "ws://localhost:4174",
        ws: true,
      },
    },
  },
});
