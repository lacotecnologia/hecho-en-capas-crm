CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"ciudad" text DEFAULT '' NOT NULL,
	"direccion" text DEFAULT '' NOT NULL,
	"documento" text DEFAULT '' NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_cargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotizacion_id" integer NOT NULL,
	"concepto" text NOT NULL,
	"valor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_imagenes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotizacion_id" integer NOT NULL,
	"url" text NOT NULL,
	"nombre" text DEFAULT '' NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizacion_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotizacion_id" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"producto_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"imagen" text,
	"cantidad" integer NOT NULL,
	"precio_fabrica" integer NOT NULL,
	"precio_venta" integer NOT NULL,
	"personalizado" boolean DEFAULT false NOT NULL,
	"dias_fabricacion" integer DEFAULT 0 NOT NULL,
	"desde_stock" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"anio" integer NOT NULL,
	"numero" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"codigo" text NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"cliente_id" integer,
	"comercial_id" integer NOT NULL,
	"modalidad" text DEFAULT 'local' NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"notas" text DEFAULT '' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"total_cargos" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"ganancia" integer DEFAULT 0 NOT NULL,
	"anticipo_pct" integer DEFAULT 0 NOT NULL,
	"anticipo" integer DEFAULT 0 NOT NULL,
	"dias_fabricacion" integer DEFAULT 0 NOT NULL,
	"dias_envio" integer DEFAULT 0 NOT NULL,
	"motivo_rechazo" text DEFAULT '' NOT NULL,
	"enviada_en" timestamp with time zone,
	"vence_en" timestamp with time zone,
	"decidida_en" timestamp with time zone,
	"reemplaza_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_cargos" ADD CONSTRAINT "cotizacion_cargos_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_imagenes" ADD CONSTRAINT "cotizacion_imagenes_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD CONSTRAINT "cotizacion_lineas_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD CONSTRAINT "cotizacion_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_comercial_id_usuarios_id_fk" FOREIGN KEY ("comercial_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cotizaciones_numero_version_idx" ON "cotizaciones" USING btree ("anio","numero","version");--> statement-breakpoint
CREATE INDEX "cotizaciones_estado_idx" ON "cotizaciones" USING btree ("estado");