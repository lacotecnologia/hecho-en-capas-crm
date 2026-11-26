ALTER TABLE "clientes" ADD COLUMN "comercial_id" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_comercial_id_usuarios_id_fk" FOREIGN KEY ("comercial_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clientes_comercial_idx" ON "clientes" USING btree ("comercial_id");--> statement-breakpoint
-- Dueño de los clientes que ya existían.
-- 1) Lo creó un comercial (que no es admin): es suyo.
UPDATE "clientes" c SET "comercial_id" = c."creado_por"
FROM "usuarios" u
WHERE u."id" = c."creado_por" AND 'comercial' = ANY(u."roles") AND NOT ('admin' = ANY(u."roles"));--> statement-breakpoint
-- 2) Si no, el último comercial (no admin) que le cotizó.
UPDATE "clientes" c SET "comercial_id" = x."comercial_id"
FROM (
  SELECT DISTINCT ON (q."cliente_id") q."cliente_id", q."comercial_id"
  FROM "cotizaciones" q
  JOIN "usuarios" u ON u."id" = q."comercial_id"
  WHERE q."cliente_id" IS NOT NULL AND 'comercial' = ANY(u."roles") AND NOT ('admin' = ANY(u."roles"))
  ORDER BY q."cliente_id", q."creado_en" DESC
) x
WHERE c."id" = x."cliente_id" AND c."comercial_id" IS NULL;--> statement-breakpoint
-- 3) El resto queda de quien lo creó (normalmente el administrador).
UPDATE "clientes" SET "comercial_id" = "creado_por" WHERE "comercial_id" IS NULL;
