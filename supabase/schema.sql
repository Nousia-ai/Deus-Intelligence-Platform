-- ─────────────────────────────────────────────────────────────────────────────
-- DEUS Intelligence Platform · Supabase schema
-- Cómo usarlo: Supabase Dashboard → SQL Editor → pegar y ejecutar
-- Seguro re-ejecutar (CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ETL audit log ──────────────────────────────────────────────────────────
-- Registra cada operación de carga de datos.
CREATE TABLE IF NOT EXISTS etl_log (
  id             BIGSERIAL    PRIMARY KEY,
  source         TEXT         NOT NULL,              -- 'csv_seed' | 'erp_import' | 'manual'
  filename       TEXT,
  rows_processed INTEGER      NOT NULL DEFAULT 0,
  rows_inserted  INTEGER      NOT NULL DEFAULT 0,
  rows_updated   INTEGER      NOT NULL DEFAULT 0,
  rows_skipped   INTEGER      NOT NULL DEFAULT 0,
  status         TEXT         NOT NULL DEFAULT 'running'
                              CHECK (status IN ('running', 'success', 'error')),
  error_message  TEXT,
  started_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  completed_at   TIMESTAMPTZ
);

-- ── 2. Dashboard cache ────────────────────────────────────────────────────────
-- Tabla singleton (id = 1 siempre). DashboardSummary completo como JSONB.
CREATE TABLE IF NOT EXISTS dashboard_cache (
  id           INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  computed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  summary      JSONB        NOT NULL,
  source       TEXT         NOT NULL DEFAULT 'csv'
                            CHECK (source IN ('csv', 'erp')),
  row_count    INTEGER,
  etl_run_id   BIGINT       REFERENCES etl_log(id)
);

-- ── 3. ventas_lineas ──────────────────────────────────────────────────────────
-- Fuente de verdad para todos los datos de ventas.
-- Replica exacta de df_ventas_v4.csv con las 52 columnas originales.
-- "año" del CSV se almacena como "anio" (compatibilidad SQL).
-- Phase 3 migrará el cómputo de analytics.ts desde CSV hacia esta tabla.
CREATE TABLE IF NOT EXISTS ventas_lineas (
  id                    BIGSERIAL      PRIMARY KEY,
  etl_run_id            BIGINT         REFERENCES etl_log(id),

  -- ── Producto ───────────────────────────────────────────────────────────────
  articulo              TEXT           NOT NULL DEFAULT '',
  marca                 TEXT           NOT NULL DEFAULT '',
  marca_en_canonico     TEXT           NOT NULL DEFAULT '',
  tipo_producto         TEXT           NOT NULL DEFAULT '',
  categoria_macro       TEXT           NOT NULL DEFAULT '',
  color                 TEXT           NOT NULL DEFAULT '',
  familia_color         TEXT           NOT NULL DEFAULT '',
  talla                 TEXT           NOT NULL DEFAULT '',
  tipo_talla            TEXT           NOT NULL DEFAULT '',
  genero                TEXT           NOT NULL DEFAULT '',
  detalles              TEXT           NOT NULL DEFAULT '',
  material              TEXT           NOT NULL DEFAULT '',
  corte                 TEXT           NOT NULL DEFAULT '',
  patron                TEXT           NOT NULL DEFAULT '',
  sku                   TEXT           NOT NULL DEFAULT '',
  es_marca_propia       BOOLEAN        NOT NULL DEFAULT FALSE,
  es_multicolor         BOOLEAN        NOT NULL DEFAULT FALSE,
  es_bundle             BOOLEAN        NOT NULL DEFAULT FALSE,
  es_cortesia           BOOLEAN        NOT NULL DEFAULT FALSE,

  -- ── Atributos adicionales de producto ─────────────────────────────────────
  manga                 TEXT           NOT NULL DEFAULT '',
  cuello                TEXT           NOT NULL DEFAULT '',
  linea                 TEXT           NOT NULL DEFAULT '',
  detalles_extra        TEXT           NOT NULL DEFAULT '',
  tiene_corte           BOOLEAN        NOT NULL DEFAULT FALSE,
  tiene_material        BOOLEAN        NOT NULL DEFAULT FALSE,
  tiene_manga           BOOLEAN        NOT NULL DEFAULT FALSE,
  tiene_linea           BOOLEAN        NOT NULL DEFAULT FALSE,
  tiene_cuello          BOOLEAN        NOT NULL DEFAULT FALSE,

  -- ── Transacción ───────────────────────────────────────────────────────────
  fecha                 DATE           NOT NULL,
  caja_prefix           TEXT           NOT NULL DEFAULT '',
  tienda                TEXT           NOT NULL DEFAULT '',
  canal                 TEXT           NOT NULL DEFAULT '',
  -- DOUBLE PRECISION = IEEE 754 float8, equivalente al number de JavaScript.
  -- Nunca desborda independientemente del valor en el CSV.
  unidades              DOUBLE PRECISION NOT NULL DEFAULT 1,
  precio_lista          DOUBLE PRECISION NOT NULL DEFAULT 0,
  precio_pagado         DOUBLE PRECISION NOT NULL DEFAULT 0,
  pct_descuento         DOUBLE PRECISION NOT NULL DEFAULT 0,
  monto_descuento       DOUBLE PRECISION NOT NULL DEFAULT 0,
  tiene_descuento       BOOLEAN          NOT NULL DEFAULT FALSE,
  importe_neto          DOUBLE PRECISION NOT NULL DEFAULT 0,
  ticket_total          DOUBLE PRECISION NOT NULL DEFAULT 0,
  forma_cobro_principal TEXT           NOT NULL DEFAULT '',
  rango_precio          TEXT           NOT NULL DEFAULT '',
  anio                  SMALLINT       NOT NULL,         -- "año" en el CSV original
  mes                   SMALLINT       NOT NULL,
  semana                SMALLINT       NOT NULL,
  dia_semana            SMALLINT       NOT NULL,

  -- ── Costo e identificadores ────────────────────────────────────────────────
  costo_unitario        DOUBLE PRECISION,                -- NULL cuando no disponible
  sucursal_id           TEXT           NOT NULL DEFAULT '',
  sku_padre             TEXT           NOT NULL DEFAULT '',
  folio                 TEXT           NOT NULL DEFAULT '',

  -- ── Metadatos de deduplicación (del proceso de limpieza del CSV) ───────────
  dup_group_size        DOUBLE PRECISION NOT NULL DEFAULT 1,
  n_duplicates          DOUBLE PRECISION NOT NULL DEFAULT 0
);

-- ── Índices para ventas_lineas ────────────────────────────────────────────────
-- Optimizados para los patrones de consulta de analytics.ts

-- Filtros principales del dashboard (sucursal + período)
CREATE INDEX IF NOT EXISTS idx_vl_sucursal_anio_mes
  ON ventas_lineas (sucursal_id, anio, mes);

-- Fecha exacta (drill-down, LFL)
CREATE INDEX IF NOT EXISTS idx_vl_fecha
  ON ventas_lineas (fecha);

-- Exclusión de cortesías (filtro universal en analytics.ts)
CREATE INDEX IF NOT EXISTS idx_vl_cortesia
  ON ventas_lineas (es_cortesia);

-- SKU performance (KPIs 12-13)
CREATE INDEX IF NOT EXISTS idx_vl_sku_padre
  ON ventas_lineas (sku_padre);

-- Análisis por categoría
CREATE INDEX IF NOT EXISTS idx_vl_categoria_anio_mes
  ON ventas_lineas (categoria_macro, anio, mes);

-- Trazabilidad ETL
CREATE INDEX IF NOT EXISTS idx_vl_etl_run
  ON ventas_lineas (etl_run_id);
