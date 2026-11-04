CREATE TABLE "comisiones" (
	"id" serial PRIMARY KEY NOT NULL,
	"comercial_id" integer NOT NULL,
	"pedido_id" integer,
	"tipo" text NOT NULL,
	"monto" integer NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"pago_id" integer,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos_comision" (
	"id" serial PRIMARY KEY NOT NULL,
	"comercial_id" integer NOT NULL,
	"total" integer NOT NULL,
	"metodo" text NOT NULL,
	"referencia" text DEFAULT '' NOT NULL,
	"comprobante_url" text,
	"nota" text DEFAULT '' NOT NULL,
	"por_fuera" boolean DEFAULT false NOT NULL,
	"pagado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_comercial_id_usuarios_id_fk" FOREIGN KEY ("comercial_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_pago_id_pagos_comision_id_fk" FOREIGN KEY ("pago_id") REFERENCES "public"."pagos_comision"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_comision" ADD CONSTRAINT "pagos_comision_comercial_id_usuarios_id_fk" FOREIGN KEY ("comercial_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos_comision" ADD CONSTRAINT "pagos_comision_pagado_por_usuarios_id_fk" FOREIGN KEY ("pagado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comisiones_comercial_idx" ON "comisiones" USING btree ("comercial_id");--> statement-breakpoint
CREATE UNIQUE INDEX "comisiones_ganada_unica_idx" ON "comisiones" USING btree ("pedido_id") WHERE "comisiones"."tipo" = 'ganada';--> statement-breakpoint
-- Los pedidos que ya estaban cerrados entran como comisión por pagar
-- (el administrador marca con "Ya se pagó por fuera" las que ya pagó).
INSERT INTO "comisiones" ("comercial_id", "pedido_id", "tipo", "monto", "nota")
SELECT p."comercial_id", p."id", 'ganada', p."ganancia", 'Pedido cerrado antes de este módulo'
FROM "pedidos" p
JOIN "usuarios" u ON u."id" = p."comercial_id"
WHERE p."estado" = 'cerrado'
  AND p."borrado_en" IS NULL
  AND p."ganancia" > 0
  AND 'comercial' = ANY(u."roles")
  AND NOT ('admin' = ANY(u."roles"));
