import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Regra de dependência do ADR-0008: dependências apontam sempre para dentro.
 * Sem verificação automática, a fronteira é violada em semanas.
 */
const layerBoundaries = [
  {
    files: ["src/domain/**/*.{ts,tsx}"],
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
                "@/app/*",
                "next",
                "next/*",
                "react",
                "react-dom",
                "@prisma/client",
                "../../application/*",
                "../../infrastructure/*",
                "../../presentation/*",
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
    files: ["src/application/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/infrastructure/*",
                "@/presentation/*",
                "@/app/*",
                "@prisma/client",
                "../../infrastructure/*",
                "../../presentation/*",
              ],
              message:
                "A aplicação depende de portas, não de implementações (ADR-0008). Declare uma porta em application/ports.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/presentation/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/infrastructure/*", "../../infrastructure/*"],
              message:
                "A apresentação chama casos de uso, nunca a infraestrutura direto (ADR-0008).",
            },
          ],
        },
      ],
    },
  },
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  ...layerBoundaries,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
