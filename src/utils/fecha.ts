/**
 * Formatea fechas para mostrarlas en Argentina sin alterar el día por zona horaria.
 * Acepta valores ISO como YYYY-MM-DD o timestamps completos.
 */
export function formatearFecha(valor?: string | null): string {
  if (!valor) return "Sin fecha";

  const fechaSimple = valor.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (fechaSimple) {
    const [, anio, mes, dia] = fechaSimple;
    return `${dia}/${mes}/${anio}`;
  }

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return valor;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);
}

/** Formatea timestamps como DD/MM/AAAA HH:mm. */
export function formatearFechaHora(valor?: string | null): string {
  if (!valor) return "Sin fecha";

  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return formatearFecha(valor);

  const fechaTexto = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(fecha);

  const horaTexto = new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);

  return `${fechaTexto} ${horaTexto}`;
}
