/**
 * Crea los 10 casilleros vacíos de una jugada.
 */
export const numerosVacios = (): string[] =>
  Array.from({ length: 10 }, () => "");

/**
 * Normaliza un número para mostrarlo siempre con dos dígitos.
 */
export const normalizarNumero = (numero: string | number): string =>
  String(numero).padStart(2, "0");

/**
 * Formatea un importe como pesos argentinos.
 */
export const formatearPesos = (monto: number): string =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
