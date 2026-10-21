-- Las dos impresoras del taller (decididas en el plan).
-- El consumo de la Kobra queda vacío hasta medirlo con un medidor de enchufe.
INSERT INTO "impresoras" ("nombre", "modelo", "multicolor", "potencia_w", "precio_compra", "vida_util_h")
VALUES
  ('Bambu Lab A1', 'A1 con AMS lite', true, 95, 3200000, 5000),
  ('Anycubic Kobra 2 Neo', 'Kobra 2 Neo', false, NULL, 800000, 5000);
