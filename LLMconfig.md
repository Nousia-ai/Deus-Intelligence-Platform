# LLM Config — Historial de Implementación

Asistente conversacional integrado en la Deus Intelligence Platform.
Modelo: **GPT-4o mini** (OpenAI) · Stack: Next.js 16 App Router + Supabase

---

## 2026-06-23 — Implementación inicial del chat

### Arquitectura elegida
Chat embebido en la plataforma (descartado: Custom GPT / MCP). Ventajas: acceso directo a datos, sin exposición de API, sin fricción de herramienta externa.

### Dependencias instaladas
- `openai@6.44.0`
- `react-markdown@10.1.0`
- `remark-gfm@4.0.1`

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/app/api/chat/route.ts` | API route con streaming + 6 tool functions (function calling server-side) |
| `src/app/(dashboard)/chat/page.tsx` | Página `/chat` |
| `src/app/(dashboard)/chat/ChatInterface.tsx` | Componente cliente con streaming, welcome screen, markdown |

### Archivo modificado
- `src/components/layout/Sidebar.tsx` — agregado ítem "Asistente / Chat con IA" con ícono `MessageSquare`

### Tool functions implementadas
1. `get_resumen_general(año?, mes?)` — ingresos, unidades, margen, ATV desde `branchMonthMatrix`
2. `get_rendimiento_sucursales(año?, mes?)` — ranking de 6 sucursales con margen por período
3. `get_tendencias_temporales(años?)` — serie mensual, YoY, patrón día de semana
4. `get_top_productos(limite?, metrica?, año?, mes?, sucursal?)` — top SKUs desde `branchMonthSKUMatrix`
5. `get_analisis_descuentos(año?, mes?)` — revenue sacrificado, profundidad, % unidades con descuento
6. `get_inventario_alertas(sucursal?, nivel_alerta?)` — consulta Supabase `inventory_kpis` en tiempo real

### Workaround crítico — Windows env var
Variables de entorno a nivel sistema/usuario sobreescriben `.env.local` en Next.js dev. Solución: leer `.env.local` directamente con `fs.readFileSync` en cada request (solo dev; Vercel inyecta correctamente en producción).

---

## 2026-06-23 — Polish y precisión del asistente

### Problemas corregidos

**1. `get_top_productos` ignoraba el período**
- Causa: siempre leía de `ceoKPIs.topSKUs` (agregado histórico completo)
- Fix: cuando se pasan `año`/`mes`, agrega desde `branchMonthSKUMatrix[branch][period][sku]`
- Agregado parámetro `sucursal` para filtrar por punto de venta

**2. LLM sin contexto de fecha ni corte de datos**
- Causa: el system prompt no tenía fecha actual ni límite del dataset
- Fix: agregado al system prompt — fecha actual (dinámica), último mes disponible (Mayo 2026), instrucción explícita: si preguntan por junio 2026, informar que no hay datos y mostrar mayo

**3. Descriptions de tools sin hints de período**
- Fix: `get_resumen_general` y `get_rendimiento_sucursales` incluyen `(año=2026, mes=5)` como referencia del período más reciente

### Formato de sugerencias
- Versión inicial: `[SUGERENCIAS: ¿...? / ¿...?]` — LLM no seguía el formato consistentemente
- Fix: parser que detecta automáticamente líneas terminadas en `?` al final de la respuesta y las renderiza como chips clickeables (indigo, rounded-full)

### Rendering de tablas markdown
- Instalado `react-markdown` + `remark-gfm`
- Custom renderers para `table`, `thead`, `th`, `td`, `ul`, `ol`, `li`, `p`, `code`

---

## 2026-06-23 — Persistencia de conversaciones (sesiones)

### Tablas creadas en Supabase
```sql
chat_sessions  (id uuid PK, title text, created_at, updated_at)
chat_messages  (id uuid PK, session_id FK → chat_sessions cascade, role, content, error bool, created_at)
-- Index: chat_messages(session_id, created_at asc)
```

### Archivos creados
| Archivo | Descripción |
|---|---|
| `src/app/api/chat/sessions/route.ts` | `GET` lista sesiones · `POST` crea sesión |
| `src/app/api/chat/sessions/[id]/route.ts` | `GET` mensajes · `POST` guarda mensajes · `PATCH` renombra · `DELETE` elimina (cascade) |
| `src/app/(dashboard)/chat/SessionPanel.tsx` | Panel lateral con grupos Hoy/Ayer/7 días/Anteriores, renombrar inline, eliminar |
| `supabase/chat_sessions.sql` | SQL migration de referencia |

### Archivo modificado
- `src/app/(dashboard)/chat/ChatInterface.tsx` — integra `SessionPanel`, gestión de estado de sesión, auto-guardado

### Comportamiento implementado
- **Auto-título**: primeros 60 caracteres del primer mensaje del usuario (igual que ChatGPT)
- **Auto-guardado**: al terminar cada streaming, guarda `[userMsg, assistantMsg]` en Supabase (fire-and-forget, no bloquea UI)
- **Reanudar sesión**: click en sesión del panel → carga mensajes desde Supabase → restaura conversación exacta
- **Nueva conversación**: resetea estado local sin afectar sesiones guardadas
- **Renombrar**: edición inline con Enter/Escape, PATCH a Supabase
- **Eliminar**: DELETE con cascade elimina sesión + todos sus mensajes
- **Graceful degradation**: si Supabase falla, el chat funciona igual (sin persistencia)

---

## Datos del negocio (contexto para el LLM)

| Parámetro | Valor |
|---|---|
| Rango de datos | Abril 2023 – Mayo 2026 |
| Revenue total | ~$52.7M MXN (tiendas físicas) |
| Sucursales | 6 físicas en Puebla: 16S001, ATL001, CSU001, CHO001, CRZ001, SND001 |
| Margen bruto promedio | ~50.7% |
| Modelo de datos | DashboardSummary pre-computado (~4MB) + caché Supabase `dashboard_cache` |
| Inventario | Tabla Supabase `inventory_kpis` (tiempo real) |
