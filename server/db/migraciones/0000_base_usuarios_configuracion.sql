CREATE TABLE "configuracion" (
	"clave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_por" integer
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"usuario" text NOT NULL,
	"pin_hash" text NOT NULL,
	"roles" text[] DEFAULT '{}' NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"intentos_fallidos" integer DEFAULT 0 NOT NULL,
	"bloqueado_hasta" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_usuario_unique" UNIQUE("usuario")
);
--> statement-breakpoint
ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_actualizado_por_usuarios_id_fk" FOREIGN KEY ("actualizado_por") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;