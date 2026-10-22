CREATE TABLE "historial_estados" (
	"id" serial PRIMARY KEY NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" integer NOT NULL,
	"de" text,
	"a" text,
	"nota" text DEFAULT '' NOT NULL,
	"visible_cliente" boolean DEFAULT false NOT NULL,
	"usuario_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordenes_produccion" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer,
	"linea_id" integer,
	"producto_id" integer NOT NULL,
	"cantidad" integer NOT NULL,
	"estado" text DEFAULT 'en_cola' NOT NULL,
	"impresora_id" integer,
	"bobina_id" integer,
	"operador_id" integer,
	"inicio" timestamp with time zone,
	"fin_estimado" timestamp with time zone,
	"fin_real" timestamp with time zone,
	"intentos" integer DEFAULT 0 NOT NULL,
	"gramos_perdidos" integer DEFAULT 0 NOT NULL,
	"motivo_falla" text DEFAULT '' NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"tipo" text NOT NULL,
	"metodo" text NOT NULL,
	"monto" integer NOT NULL,
	"referencia" text DEFAULT '' NOT NULL,
	"comprobante_url" text,
	"usuario_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_cargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"concepto" text NOT NULL,
	"valor" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedido_lineas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"producto_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"descripcion" text DEFAULT '' NOT NULL,
	"imagen" text,
	"cantidad" integer NOT NULL,
	"precio_fabrica" integer NOT NULL,
	"precio_venta" integer NOT NULL,
	"personalizado" boolean DEFAULT false NOT NULL,
	"desde_stock" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"anio" integer NOT NULL,
	"numero" integer NOT NULL,
	"codigo" text NOT NULL,
	"seguimiento" text NOT NULL,
	"cotizacion_id" integer NOT NULL,
	"cliente_id" integer NOT NULL,
	"comercial_id" integer NOT NULL,
	"estado" text DEFAULT 'confirmado' NOT NULL,
	"modalidad" text NOT NULL,
	"subtotal" integer NOT NULL,
	"total_cargos" integer DEFAULT 0 NOT NULL,
	"descuento" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"ganancia" integer DEFAULT 0 NOT NULL,
	"anticipo_pct" integer DEFAULT 0 NOT NULL,
	"anticipo" integer DEFAULT 0 NOT NULL,
	"requiere_anticipo" boolean DEFAULT false NOT NULL,
	"producir_sin_anticipo" boolean DEFAULT false NOT NULL,
	"dias_fabricacion" integer DEFAULT 0 NOT NULL,
	"dias_envio" integer DEFAULT 0 NOT NULL,
	"fecha_compromiso" timestamp with time zone,
	"notas" text DEFAULT '' NOT NULL,
	"numero_factura" text DEFAULT '' NOT NULL,
	"motivo_cancelacion" text DEFAULT '' NOT NULL,
	"creado_por" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_seguimiento_unique" UNIQUE("seguimiento"),
	CONSTRAINT "pedidos_cotizacion_id_unique" UNIQUE("cotizacion_id")
);
--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD COLUMN "pedido_id" integer;--> statement-breakpoint
ALTER TABLE "movimientos_stock" ADD COLUMN "orden_id" integer;--> statement-breakpoint
ALTER TABLE "historial_estados" ADD CONSTRAINT "historial_estados_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_linea_id_pedido_lineas_id_fk" FOREIGN KEY ("linea_id") REFERENCES "public"."pedido_lineas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_impresora_id_impresoras_id_fk" FOREIGN KEY ("impresora_id") REFERENCES "public"."impresoras"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_bobina_id_bobinas_id_fk" FOREIGN KEY ("bobina_id") REFERENCES "public"."bobinas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_operador_id_usuarios_id_fk" FOREIGN KEY ("operador_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordenes_produccion" ADD CONSTRAINT "ordenes_produccion_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_cargos" ADD CONSTRAINT "pedido_cargos_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_lineas" ADD CONSTRAINT "pedido_lineas_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cotizacion_id_cotizaciones_id_fk" FOREIGN KEY ("cotizacion_id") REFERENCES "public"."cotizaciones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_comercial_id_usuarios_id_fk" FOREIGN KEY ("comercial_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_creado_por_usuarios_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "historial_entidad_idx" ON "historial_estados" USING btree ("entidad","entidad_id");--> statement-breakpoint
CREATE INDEX "ordenes_estado_idx" ON "ordenes_produccion" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "ordenes_pedido_idx" ON "ordenes_produccion" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_numero_idx" ON "pedidos" USING btree ("anio","numero");--> statement-breakpoint
CREATE INDEX "pedidos_estado_idx" ON "pedidos" USING btree ("estado");