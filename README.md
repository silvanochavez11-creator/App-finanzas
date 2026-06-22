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
vite.config.js
src/
  main.jsx              # punto de entrada
  FinanceApp.jsx        # componente principal y lógica
  format.js             # multi-moneda + contexto de formato
  charts/
    MonthlyChart.jsx    # gráfica de barras (lazy)
    ProjectionChart.jsx # gráfica de línea (lazy)
```

## Optimización

- Build con **Vite** (minificado con esbuild, `target: es2020`).
- **Code-splitting**: `recharts` (~150 kB gzip) se carga **bajo demanda** vía `React.lazy`; la carga inicial es ~24 kB gzip.
- Chunks separados (`react`, `charts`, `vendor`) para mejor cacheo del navegador.

## Persistencia

Usa `window.storage` cuando está disponible y cae a `localStorage` en cualquier navegador.

## Dependencias

`react`, `recharts`, `papaparse`, `lucide-react`.

## Nota sobre el Asistente IA

La llamada a la API de Anthropic se hace desde el cliente. En producción debe pasar por un backend/proxy que guarde la API key de forma segura (nunca exponerla en el frontend).
