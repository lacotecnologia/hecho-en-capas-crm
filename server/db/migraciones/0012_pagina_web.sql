ALTER TABLE "productos" ADD COLUMN "en_web" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "precio_web" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "etiqueta_web" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "grupo_web" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "tamano_web" text DEFAULT '' NOT NULL;