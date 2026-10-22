CREATE TABLE "entregas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"modalidad" text NOT NULL,
	"estado" text DEFAULT 'por_programar' NOT NULL,
	"fecha_programada" timestamp with time zone,
	"franja" text DEFAULT '' NOT NULL,
	"direccion" text DEFAULT '' NOT NULL,
	"ciudad" text DEFAULT '' NOT NULL,
	"recibe" text DEFAULT '' NOT NULL,
	"telefono" text DEFAULT '' NOT NULL,
	"quien_lleva" text,
	"mensajero_id" integer,
	"servicio_tercero" text DEFAULT '' NOT NULL,
	"transportadora" text DEFAULT '' NOT NULL,
	"guia" text DEFAULT '' NOT NULL,
	"costo_cobrado" integer DEFAULT 0 NOT NULL,
	"costo_real" integer,
	"contraentrega" boolean DEFAULT false NOT NULL,
	"monto_contraentrega" integer DEFAULT 0 NOT NULL,
	"evidencia_url" text,
	"novedad" text DEFAULT '' NOT NULL,
	"recibido_por" text DEFAULT '' NOT NULL,
	"salio_en" timestamp with time zone,
	"entregada_en" timestamp with time zone,
	"notas" text DEFAULT '' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entregas_pedido_id_unique" UNIQUE("pedido_id")
);
--> statement-breakpoint
ALTER TABLE "pagos" ADD COLUMN "nota" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_mensajero_id_usuarios_id_fk" FOREIGN KEY ("mensajero_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entregas_estado_idx" ON "entregas" USING btree ("estado");--> statement-breakpoint
-- Los pedidos que ya existían reciben su entrega "por programar"
INSERT INTO "entregas" ("pedido_id", "modalidad", "direccion", "ciudad", "telefono", "costo_cobrado")
SELECT p."id", p."modalidad", c."direccion", c."ciudad", c."whatsapp",
  COALESCE((SELECT SUM(g."valor") FROM "pedido_cargos" g WHERE g."pedido_id" = p."id"
    AND g."concepto" ~* '(env[ií]o|domicilio|transporte|flete)'), 0)
FROM "pedidos" p JOIN "clientes" c ON c."id" = p."cliente_id"
WHERE NOT EXISTS (SELECT 1 FROM "entregas" e WHERE e."pedido_id" = p."id");
