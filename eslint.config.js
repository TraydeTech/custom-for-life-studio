import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // dist = build; supabase/functions = Deno runtime (tooling próprio, não o app Vite)
  { ignores: ["dist", "supabase/functions"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Componentes shadcn/ui e contexts exportam variants/hooks junto do componente
    // (padrão da lib). A regra é só DX de fast-refresh, sem impacto em runtime.
    files: ["src/components/ui/**", "src/contexts/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
);
