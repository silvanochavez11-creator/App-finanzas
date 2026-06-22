# Tu Ruta Financiera

App de finanzas personales con gamificación (inspirada en *Cashflow / Rat Race*). Un componente React (`financeapp.jsx`) con tema oscuro.

## Funciones

- **Tablero**: KPIs (ingresos, gastos, patrimonio neto, ahorro/mes), gráfica mensual, alertas de presupuesto y recordatorio de conceptos fijos.
- **Asistente IA**: describes tus finanzas en texto libre y la IA extrae tus ingresos/gastos fijos como plantilla mensual.
- **Movimientos**: alta, **edición** y borrado; **búsqueda y filtros** (tipo, categoría, rango de fechas); importar y **exportar CSV**.
- **Presupuestos**: límite mensual por categoría con barras de progreso y **alertas** al 80% y al rebasar.
- **Patrimonio**: registro de **activos y deudas** para calcular el patrimonio neto real (activos − deudas).
- **Proyección**: simulador de interés compuesto con meta de compra ("¿en cuántos meses llego?").
- **Multi-moneda**: MXN, USD, EUR, COP, ARS, CLP.
- **Conceptos fijos**: plantilla mensual aplicable con un clic cada mes (sin doble conteo).

## Cómo correrlo

```bash
npm install
npm run dev      # desarrollo (http://localhost:5173)
npm run build    # build de producción en /dist
npm run preview  # sirve el build de producción
```

## Estructura

```
index.html
vite.config.js          # build + proxy /api/extract en dev
api/
  extract.js            # función serverless (Vercel) del Asistente IA
server/
  anthropic.js          # lógica compartida del proxy (la API key vive aquí)
src/
  main.jsx              # punto de entrada
  FinanceApp.jsx        # componente principal y lógica
  format.js             # multi-moneda + contexto de formato
  charts/
    MonthlyChart.jsx    # gráfica de barras (lazy)
    ProjectionChart.jsx # gráfica de línea (lazy)
```

## Asistente IA (backend seguro)

La key de Anthropic **nunca** llega al navegador. El cliente llama a `POST /api/extract`
con `{ text }` y el servidor reenvía la petición a la API usando `ANTHROPIC_API_KEY`.

```bash
cp .env.example .env     # y pon tu ANTHROPIC_API_KEY
npm run dev              # /api/extract se sirve vía middleware de Vite
```

En producción (Vercel) la carpeta `api/` se despliega como función serverless;
define `ANTHROPIC_API_KEY` en las variables de entorno del proyecto. La misma lógica
(`server/anthropic.js`) corre en dev y en producción.

## Optimización

- Build con **Vite** (minificado con esbuild, `target: es2020`).
- **Code-splitting**: `recharts` (~150 kB gzip) se carga **bajo demanda** vía `React.lazy`; la carga inicial es ~24 kB gzip.
- Chunks separados (`react`, `charts`, `vendor`) para mejor cacheo del navegador.

## Persistencia

Usa `window.storage` cuando está disponible y cae a `localStorage` en cualquier navegador.

## Dependencias

`react`, `recharts`, `papaparse`, `lucide-react`.
