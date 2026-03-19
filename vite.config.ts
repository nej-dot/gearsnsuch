import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

function normalizeBasePath(value?: string) {
  if (!value || value === "/") {
    return "/";
  }

  const withLeadingSlash = value[0] === "/" ? value : `/${value}`;
  return withLeadingSlash[withLeadingSlash.length - 1] === "/"
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    base: normalizeBasePath(env.VITE_BASE_PATH),
  };
});
