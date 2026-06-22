import { createContext, useContext } from "react";

// ---------- Multi-moneda ----------
export const CURRENCIES = {
  MXN: { locale: "es-MX", code: "MXN", label: "Peso MX ($)" },
  USD: { locale: "en-US", code: "USD", label: "Dólar (US$)" },
  EUR: { locale: "es-ES", code: "EUR", label: "Euro (€)" },
  COP: { locale: "es-CO", code: "COP", label: "Peso COL ($)" },
  ARS: { locale: "es-AR", code: "ARS", label: "Peso ARG ($)" },
  CLP: { locale: "es-CL", code: "CLP", label: "Peso CL ($)" },
};

export const makeFmt = (cur) => (n) =>
  new Intl.NumberFormat((CURRENCIES[cur] || CURRENCIES.MXN).locale, {
    style: "currency",
    currency: (CURRENCIES[cur] || CURRENCIES.MXN).code,
    maximumFractionDigits: 0,
  }).format(n || 0);

export const FmtCtx = createContext(makeFmt("MXN"));
export const useFmt = () => useContext(FmtCtx);
