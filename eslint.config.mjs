import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    ".kilo/**",
  ]),
  {
    // React Three Fiber drives three.js imperatively: uniforms, materials and
    // scene-graph slots (`scene.fog`, `scene.environment`) are *meant* to be
    // mutated every frame from `useFrame`, and those objects are created once
    // in a memo/ref rather than re-rendered. The React Compiler's immutability
    // rule models those writes as forbidden, so it is scoped off for the 3D
    // layer only. Everything outside `src/components/3d` keeps the full rule.
    files: ["src/components/3d/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
