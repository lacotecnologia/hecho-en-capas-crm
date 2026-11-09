-- Pasa al CRM los productos que la página web mostraba fijos (noviembre 2026).
-- Quedan "por costear" (sin precio de fábrica) y marcados para la web, sin precio
-- ("Consulta el precio"). Los colores se enlazan solo si hay bobinas activas con
-- ese mismo nombre de color (mínimo 2); si no, el taller los marca a mano.
CREATE FUNCTION pg_temp.producto_web(
  p_nombre text, p_descripcion text, p_categoria text, p_tipo text, p_personaliza boolean,
  p_etiqueta text, p_grupo text, p_tamano text, p_fotos text[], p_colores text[]
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pid integer;
  i integer;
BEGIN
  INSERT INTO productos (nombre, descripcion, categoria, tipo, estado, personaliza_texto,
      en_web, precio_web, etiqueta_web, grupo_web, tamano_web)
    VALUES (p_nombre, p_descripcion, p_categoria, p_tipo, 'costeo', p_personaliza,
      true, NULL, p_etiqueta, p_grupo, p_tamano)
    RETURNING id INTO pid;
  FOR i IN 1 .. coalesce(array_length(p_fotos, 1), 0) LOOP
    INSERT INTO producto_archivos (producto_id, tipo, nombre, url, es_portada)
      VALUES (pid, 'imagen', regexp_replace(p_fotos[i], '^.*/', ''), p_fotos[i], i = 1);
  END LOOP;
  INSERT INTO producto_colores (producto_id, bobina_id, orden)
    SELECT pid, b.id, x.orden - 1
    FROM unnest(p_colores) WITH ORDINALITY AS x(color, orden)
    CROSS JOIN LATERAL (
      SELECT id FROM bobinas
      WHERE activa AND borrado_en IS NULL AND lower(trim(color)) = lower(x.color)
      ORDER BY id LIMIT 1
    ) b
    ON CONFLICT DO NOTHING;
  IF (SELECT count(*) FROM producto_colores WHERE producto_id = pid) >= 2 THEN
    UPDATE productos SET escoge_color = true WHERE id = pid;
  ELSE
    DELETE FROM producto_colores WHERE producto_id = pid;
  END IF;
END $$;
--> statement-breakpoint
SELECT pg_temp.producto_web('Reno 3D · 9 cm', 'Un detalle único y adorable para regalar en Navidad. Ideal para regalar o decorar en Navidad, cumpleaños o como coleccionable. Impreso en PLA, capa por capa.', 'Navidad', 'catalogo', false, 'De temporada', 'Reno 3D', '9 cm', ARRAY['https://hechoencapas.vercel.app/images/productos/reno-1.webp','https://hechoencapas.vercel.app/images/productos/reno-2.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Reno 3D · 12 cm', 'Un detalle único y adorable para regalar en Navidad. Ideal para regalar o decorar en Navidad, cumpleaños o como coleccionable. Impreso en PLA, capa por capa.', 'Navidad', 'catalogo', false, 'De temporada', 'Reno 3D', '12 cm', ARRAY['https://hechoencapas.vercel.app/images/productos/reno-1.webp','https://hechoencapas.vercel.app/images/productos/reno-2.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Árbol Boreal3D con luz LED · 9 cm', 'Árbol navideño que reparte la luz cálida de una vela LED. Difunde la luz de forma pareja y crea un ambiente acogedor. Lleva vela LED de bajo consumo y un portavela 3D que encaja en tu soporte.', 'Navidad', 'catalogo', false, 'De temporada', 'Árbol Boreal3D con luz LED', '9 cm', ARRAY['https://hechoencapas.vercel.app/images/productos/boreal-1.webp','https://hechoencapas.vercel.app/images/productos/boreal-2.webp','https://hechoencapas.vercel.app/images/productos/boreal-3.webp']::text[], ARRAY['Blanco','Verde','Rojo','Amarillo']::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Árbol Boreal3D con luz LED · 12 cm', 'Árbol navideño que reparte la luz cálida de una vela LED. Difunde la luz de forma pareja y crea un ambiente acogedor. Lleva vela LED de bajo consumo y un portavela 3D que encaja en tu soporte.', 'Navidad', 'catalogo', false, 'De temporada', 'Árbol Boreal3D con luz LED', '12 cm', ARRAY['https://hechoencapas.vercel.app/images/productos/boreal-1.webp','https://hechoencapas.vercel.app/images/productos/boreal-2.webp','https://hechoencapas.vercel.app/images/productos/boreal-3.webp']::text[], ARRAY['Blanco','Verde','Rojo','Amarillo']::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Árbol Boreal3D con luz LED · 16 cm', 'Árbol navideño que reparte la luz cálida de una vela LED. Difunde la luz de forma pareja y crea un ambiente acogedor. Lleva vela LED de bajo consumo y un portavela 3D que encaja en tu soporte.', 'Navidad', 'catalogo', false, 'De temporada', 'Árbol Boreal3D con luz LED', '16 cm', ARRAY['https://hechoencapas.vercel.app/images/productos/boreal-1.webp','https://hechoencapas.vercel.app/images/productos/boreal-2.webp','https://hechoencapas.vercel.app/images/productos/boreal-3.webp']::text[], ARRAY['Blanco','Verde','Rojo','Amarillo']::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Árbol Boreal3D con luz LED · Kit x 4', 'Árbol navideño que reparte la luz cálida de una vela LED. Difunde la luz de forma pareja y crea un ambiente acogedor. Lleva vela LED de bajo consumo y un portavela 3D que encaja en tu soporte. Kit de 4 unidades en colores surtidos.', 'Navidad', 'catalogo', false, 'De temporada', 'Árbol Boreal3D con luz LED', 'Kit x 4, colores surtidos', ARRAY['https://hechoencapas.vercel.app/images/productos/boreal-3.webp','https://hechoencapas.vercel.app/images/productos/boreal-1.webp','https://hechoencapas.vercel.app/images/productos/boreal-2.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Lagartija 3D con resorte', 'Se mueve con las vibraciones del carro o la moto. Ahora con un resorte mejorado, más resistente y duradero. Un regalo diferente para niños, adultos y amantes de los carros y las motos.', 'Regalos y decoración', 'catalogo', false, 'Resorte mejorado', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/lagartija-1.webp','https://hechoencapas.vercel.app/images/productos/lagartija-2.webp']::text[], ARRAY['Verde','Azul','Morado','Celeste']::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Lagartija hincha del América', 'La lagartija con la camiseta roja del América de Cali. Edición futbolera de la lagartija, con camiseta, pantaloneta y medias rojas, sobre base negra.', 'Regalos y decoración', 'catalogo', false, 'Edición fútbol', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/lagartija-america.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Letra decorativa 3D con luz LED', 'Tu inicial con el nombre que quieras, iluminada con luz cálida. Mide unos 20 cm de alto. Iluminación LED integrada en las letras, con efecto cálido y elegante. Ideal para habitación infantil, decoración del hogar o regalos especiales. Cuéntanos el nombre al hacer tu pedido.', 'Regalos y decoración', 'catalogo', true, 'A tu medida', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/letra-1.webp','https://hechoencapas.vercel.app/images/productos/letra-2.webp']::text[], ARRAY['Crema','Beige','Rosado','Celeste']::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Habladores QR y NFC para tu negocio', 'Con tu logo y tus colores: tus clientes llegan a tu menú, redes o pagos. Con código QR o NFC (acercan el celular y listo). Miden de 15 a 20 cm de alto. Detalles en relieve, base desmontable y acabados a tu gusto. Perfectos para restaurantes, tiendas, cafeterías y servicios.', 'Para tu negocio', 'personalizado', false, 'Para tu negocio', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/hablador-1.webp','https://hechoencapas.vercel.app/images/productos/hablador-2.webp','https://hechoencapas.vercel.app/images/productos/hablador-3.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Llavero con tu logo', 'Tu marca en un llavero resistente, ideal para regalar a tus clientes. Nos envías tu logo y te mostramos cómo queda antes de fabricarlo. Lo hacemos en los colores que prefieras.', 'Para tu negocio', 'personalizado', false, 'A tu medida', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/llavero.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Corazón anatómico para estudiar', 'Modelo del corazón humano en 3D, con base y placa. Pensado para clases, estudiantes y consultorios: se ven las cavidades, los vasos y las arterias en relieve.', 'Educación y técnica', 'catalogo', false, 'Educativo', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/corazon.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Piezas técnicas y prototipos', 'Soportes, engranajes, repuestos y prototipos que funcionan. Los fabricamos a partir de tu idea, un plano o la pieza original. Te confirmamos medidas y material antes de imprimir.', 'Educación y técnica', 'personalizado', false, 'A tu medida', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/prototipo.webp','https://hechoencapas.vercel.app/images/productos/engranaje.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Diseño 3D de tu idea', 'Modelamos en 3D lo que necesitas y luego lo imprimimos. Parte de una foto, un boceto o unas medidas. Te mostramos el modelo antes de fabricarlo.', 'Educación y técnica', 'personalizado', false, 'Servicio', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/diseno-3d.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
SELECT pg_temp.producto_web('Figura coleccionable', 'Figuras con detalle fino sobre base decorada. Impresas capa por capa, con relieves y grabados en la base. Pregúntanos por otros personajes.', 'Regalos y decoración', 'catalogo', false, 'Coleccionable', '', '', ARRAY['https://hechoencapas.vercel.app/images/productos/figura.webp']::text[], ARRAY[]::text[]);
--> statement-breakpoint
DROP FUNCTION pg_temp.producto_web(text, text, text, text, boolean, text, text, text, text[], text[]);
