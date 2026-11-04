ALTER TABLE "cotizacion_lineas" ADD COLUMN "de_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD COLUMN "textos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "listo_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "entrega_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "entrega_frase" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "entrega_valida_hasta" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "entrega_pasos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD COLUMN "hora_limite" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD COLUMN "de_stock" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD COLUMN "textos" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "listo_compromiso" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "personaliza_texto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "max_letras" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "min_personalizar" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "precio_personalizar" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Lo que ya salió de existencias completo
UPDATE "pedido_lineas" SET "de_stock" = "cantidad" WHERE "desde_stock";--> statement-breakpoint
UPDATE "cotizacion_lineas" SET "de_stock" = "cantidad" WHERE "desde_stock";
