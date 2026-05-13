import { defineConfig } from "vite";
import { execSync } from "child_process";

function getVersion(): string {
  try {
    const hash = execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return `${date}-${hash}`;
  } catch {
    return "dev";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(getVersion()),
  },
});
