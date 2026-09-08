import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Regra de dependência do ADR-0008: dependências apontam sempre para dentro.
 * Sem verificação automática, a fronteira é violada em semanas.
 */
const layerBoundaries = [
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/application/*",
                "@/infrastructure/*",
                "@/presentation/*",
                "express",
                "@prisma/client",
                "**/application/*",
                "**/infrastructure/*",
                "**/presentation/*",
              ],
              message:
                "O domínio não depende de nenhuma camada externa (ADR-0008). Receba o dado por parâmetro.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure/*",
                "@/presentation/*",
                "express",
                "@prisma/client",
                "**/infrastructure/*",
                "**/presentation/*",
              ],
              message:
                "A aplicação depende de portas, não de implementações (ADR-0008).",
            },
          ],
        },
      ],
    },
  },
];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...layerBoundaries,
);
