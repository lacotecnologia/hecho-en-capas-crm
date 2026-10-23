ALTER TABLE "bobinas" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bobinas" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "impresoras" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "impresoras" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "borrado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "borrado_por" integer;--> statement-breakpoint
ALTER TABLE "bobinas" ADD CONSTRAINT "bobinas_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cotizaciones" ADD CONSTRAINT "cotizaciones_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "impresoras" ADD CONSTRAINT "impresoras_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_borrado_por_usuarios_id_fk" FOREIGN KEY ("borrado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;