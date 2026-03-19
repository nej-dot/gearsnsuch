import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
function normalizeBasePath(value) {
    if (!value || value === "/") {
        return "/";
    }
    var withLeadingSlash = value[0] === "/" ? value : "/".concat(value);
    return withLeadingSlash[withLeadingSlash.length - 1] === "/"
        ? withLeadingSlash
        : "".concat(withLeadingSlash, "/");
}
export default defineConfig(function (_a) {
    var mode = _a.mode;
    var env = loadEnv(mode, ".", "");
    return {
        plugins: [react()],
        base: normalizeBasePath(env.VITE_BASE_PATH),
    };
});
