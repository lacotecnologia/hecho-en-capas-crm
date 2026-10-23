CREATE TABLE "producto_colores" (
	"id" serial PRIMARY KEY NOT NULL,
	"producto_id" integer NOT NULL,
	"bobina_id" integer NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD COLUMN "bobina_id" integer;--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD COLUMN "color" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD COLUMN "color_hex" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD COLUMN "bobina_id" integer;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD COLUMN "color_bobina_id" integer;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD COLUMN "bobina_id" integer;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD COLUMN "color" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD COLUMN "color_hex" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "escoge_color" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "producto_colores" ADD CONSTRAINT "producto_colores_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producto_colores" ADD CONSTRAINT "producto_colores_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "producto_colores_unico_idx" ON "producto_colores" USING btree ("producto_id","bobina_id");--> statement-breakpoint
ALTER TABLE "cotizacion_lineas" ADD CONSTRAINT "cotizacion_lineas_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD CONSTRAINT "movimientos_stock_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_color_bobina_id_bobinas_id_fk" FOREIGN KEY ("color_bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;