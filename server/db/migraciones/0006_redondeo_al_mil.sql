-- Los precios de fábrica pasan de redondearse a la centena a redondearse al mil.
-- Se recalculan con el costo y el margen guardados en cada producto.
UPDATE "productos"
SET "precio_calculado" = CASE
  WHEN "costo" > 0 THEN (CEIL(("costo" * (100 + "margen_pct"))::numeric / 100000) * 1000)::integer
  ELSE 0
END;
--> statement-breakpoint
-- Los precios subidos a mano también quedan redondos al mil (hacia arriba).
UPDATE "productos"
SET "precio_manual" = (CEIL("precio_manual"::numeric / 1000) * 1000)::integer
WHERE "precio_manual" IS NOT NULL;
--> statement-breakpoint
-- Si el precio a mano ya no supera al calculado, deja de ser un ajuste.
UPDATE "productos"
SET "precio_manual" = NULL, "nota_ajuste" = ''
WHERE "precio_manual" IS NOT NULL AND "precio_manual" <= "precio_calculado";
--> statement-breakpoint
-- El precio con el que trabaja el comercial (solo productos que ya tenían precio).
UPDATE "productos"
SET "precio_fabrica" = COALESCE("precio_manual", "precio_calculado")
WHERE "precio_fabrica" > 0;
