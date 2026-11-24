CREATE TABLE "cuentas_cobro" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" integer NOT NULL,
	"codigo" text NOT NULL,
	"pedido_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"fecha" text NOT NULL,
	"total" integer NOT NULL,
	"pagador" text NOT NULL,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"datos" jsonb NOT NULL,
	"token" text NOT NULL,
	"enviada_en" timestamp with time zone,
	"recibida_en" timestamp with time zone,
	"aceptada_en" timestamp with time zone,
	"motivo_anulacion" text DEFAULT '' NOT NULL,
	"anulada_en" timestamp with time zone,
	"anulada_por" integer,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cuentas_cobro_numero_unique" UNIQUE("numero"),
	CONSTRAINT "cuentas_cobro_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "cuentas_cobro_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_anulada_por_usuarios_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuentas_cobro" ADD CONSTRAINT "cuentas_cobro_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_cobro_vigente_idx" ON "cuentas_cobro" USING btree ("pedido_id") WHERE "cuentas_cobro"."estado" = 'vigente';