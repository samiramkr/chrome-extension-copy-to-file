import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Save to Google Docs",
    description:
      "Select text on any webpage and save it to your Google Doc with source URL and timestamp.",
    permissions: ["identity", "contextMenus", "storage", "activeTab", "scripting"],
    host_permissions: [
      "https://docs.googleapis.com/*",
      "https://www.googleapis.com/*",
    ],
    oauth2: {
      client_id:
        "42938059327-if9ht49cdkj94lelpr2sandjrq5fj28h.apps.googleusercontent.com",
      scopes: [
        "https://www.googleapis.com/auth/documents",
        "https://www.googleapis.com/auth/drive.readonly",
      ],
    },
    commands: {
      "save-selection": {
        suggested_key: {
          default: "Ctrl+Shift+S",
          mac: "Command+Shift+S",
        },
        description: "Save selected text to Google Docs",
      },
    },
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
