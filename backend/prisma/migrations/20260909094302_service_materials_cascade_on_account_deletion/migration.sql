-- A exclusão de conta do `RF-01` precisa atravessar users -> businesses ->
-- materials -> service_materials. Com RESTRICT, uma conta que tenha qualquer
-- serviço com material composto não podia ser apagada, o que contraria a
-- remoção efetiva exigida pelo `RF-12`.
--
-- Recusar a exclusão de um material em uso continua sendo regra da aplicação,
-- que responde 409 explicando o arquivamento em vez de estourar violação de
-- chave estrangeira.

ALTER TABLE "service_materials" DROP CONSTRAINT "service_materials_material_id_fkey";

ALTER TABLE "service_materials" ADD CONSTRAINT "service_materials_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
