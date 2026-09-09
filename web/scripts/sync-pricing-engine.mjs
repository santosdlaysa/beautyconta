import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Recopia o motor de precificação da API para o espelho da web.
 *
 * Existe para que a atualização do espelho seja um comando, e não um
 * copiar-e-colar manual: `tests/pricing-parity.test.ts` quebra assim que os dois
 * arquivos se afastam, e quem for consertar precisa de um caminho óbvio.
 *
 * A direção é sempre backend → web. O motor da API é a fonte de verdade.
 */

const at = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const mirror = at("../src/domain/pricing/calculate-price.ts");
const banner = readFileSync(mirror, "utf8").split("import { DomainError }")[0];

writeFileSync(mirror, banner + readFileSync(at("../../backend/src/domain/pricing/calculate-price.ts"), "utf8"));
copyFileSync(at("../../backend/src/domain/shared/domain-error.ts"), at("../src/domain/shared/domain-error.ts"));

console.log("Espelho do motor atualizado a partir de backend/src/domain/pricing.");
