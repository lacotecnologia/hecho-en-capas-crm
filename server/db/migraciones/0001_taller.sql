CREATE TABLE "bobinas" (
	"id" serial PRIMARY KEY NOT NULL,
	"material" text NOT NULL,
	"color" text NOT NULL,
	"color_hex" text DEFAULT '#999999' NOT NULL,
	"marca" text DEFAULT '' NOT NULL,
	"serial" text DEFAULT '' NOT NULL,
	"precio_rollo" integer NOT NULL,
	"peso_g" integer DEFAULT 1000 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "impresoras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"modelo" text DEFAULT '' NOT NULL,
	"multicolor" boolean DEFAULT false NOT NULL,
	"potencia_w" integer,
	"precio_compra" integer NOT NULL,
	"vida_util_h" integer DEFAULT 5000 NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"cantidad" integer NOT NULL,
	"nota" text DEFAULT '' NOT NULL,
	"usuario_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producto_archivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"nombre" text NOT NULL,
	"url" text NOT NULL,
	"tamano_bytes" integer DEFAULT 0 NOT NULL,
	"es_portada" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" text,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"categoria" text DEFAULT '' NOT NULL,
	"tipo" text DEFAULT 'catalogo' NOT NULL,
	"estado" text DEFAULT 'costeo' NOT NULL,
	"multicolor" boolean DEFAULT false NOT NULL,
	"dias_fabricacion" integer DEFAULT 2 NOT NULL,
	"impresora_id" integer,
	"bobina_id" integer,
	"gramos" double precision DEFAULT 0 NOT NULL,
	"horas" double precision DEFAULT 0 NOT NULL,
	"unidades_por_cama" integer DEFAULT 1 NOT NULL,
	"min_preparacion" integer DEFAULT 0 NOT NULL,
	"min_postproceso" integer DEFAULT 0 NOT NULL,
	"horas_diseno" double precision DEFAULT 0 NOT NULL,
	"unidades_lote" integer DEFAULT 1 NOT NULL,
	"empaque" integer DEFAULT 0 NOT NULL,
	"margen_pct" integer DEFAULT 50 NOT NULL,
	"costo" integer DEFAULT 0 NOT NULL,
	"precio_calculado" integer DEFAULT 0 NOT NULL,
	"precio_manual" integer,
	"nota_ajuste" text DEFAULT '' NOT NULL,
	"precio_fabrica" integer DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_archivos" ADD CONSTRAINT "producto_archivos_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_impresora_id_impresoras_id_fk" FOREIGN KEY ("impresora_id") REFERENCES "public"."impresoras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_estado_idx" ON "productos" USING btree ("estado");