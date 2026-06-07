-- ─────────────────────────────────────────────────────────────────────────────
-- DEUS Intelligence Platform · Supabase schema v1
-- Cómo usarlo: Supabase Dashboard → SQL Editor → pegar y ejecutar
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ETL audit log ──────────────────────────────────────────────────────────
-- Registra cada operación de carga de datos (semilla inicial, importaciones ERP, etc.)
CREATE TABLE IF NOT EXISTS etl_log (
  id             BIGSERIAL    PRIMARY KEY,
  source         TEXT         NOT NULL,              -- 'csv_seed' | 'erp_import' | 'manual'
  filename       TEXT,                               -- nombre del archivo procesado
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
-- Tabla singleton (siempre id = 1).
-- Almacena el DashboardSummary completo como JSONB.
-- El servidor Next.js lo lee en <300 ms en lugar de parsear el CSV de 70 MB.
CREATE TABLE IF NOT EXISTS dashboard_cache (
  id           INTEGER      PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  computed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  summary      JSONB        NOT NULL,
  source       TEXT         NOT NULL DEFAULT 'csv'
                            CHECK (source IN ('csv', 'erp')),
  row_count    INTEGER,                              -- filas de ventas_lineas usadas
  etl_run_id   BIGINT       REFERENCES etl_log(id)  -- qué carga ETL originó este cache
);

-- ─────────────────────────────────────────────────────────────────────────────
-- NOTA: la tabla ventas_lineas (datos crudos por fila) se agregará en Phase 2
-- junto con el pipeline ETL del ERP. Por ahora el cómputo sigue corriendo
-- sobre el CSV local; solo el resultado (DashboardSummary) se cachea aquí.
-- ─────────────────────────────────────────────────────────────────────────────
