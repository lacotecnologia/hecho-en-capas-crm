ALTER TABLE "clientes" ADD COLUMN "etapa" text DEFAULT 'cliente' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "origen" text DEFAULT 'crm' NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "google_sub" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "acepto_datos_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "origen" text DEFAULT 'crm' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "precio_tienda" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "en_tienda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "atiende_tienda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_google_sub_unique" UNIQUE("google_sub");