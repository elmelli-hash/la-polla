const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires'

/**
 * Formatea fechas guardadas como YYYY-MM-DD.
 * No usa new Date() para evitar que cambie un día por diferencia horaria.
 */
export function formatearFecha(fecha?: string | null): string {
  if (!fecha) return 'Sin fecha'

  const fechaLimpia = fecha.slice(0, 10)
  const partes = fechaLimpia.split('-')

  if (partes.length !== 3) return fecha

  const [anio, mes, dia] = partes

  if (!anio || !mes || !dia) return fecha

  return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${anio}`
}

/**
 * Formatea timestamps de Supabase usando hora argentina.
 */
export function formatearFechaHora(fecha?: string | null): string {
  if (!fecha) return 'Sin fecha'

  const valor = new Date(fecha)

  if (Number.isNaN(valor.getTime())) return 'Sin fecha'

  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(valor)
}

/**
 * Devuelve la fecha actual de Argentina como YYYY-MM-DD.
 * Se usa como valor interno de input type="date".
 */
export function obtenerFechaArgentinaISO(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const anio = partes.find((parte) => parte.type === 'year')?.value
  const mes = partes.find((parte) => parte.type === 'month')?.value
  const dia = partes.find((parte) => parte.type === 'day')?.value

  if (!anio || !mes || !dia) {
    return new Date().toISOString().slice(0, 10)
  }

  return `${anio}-${mes}-${dia}`
}

/**
 * Devuelve correctamente el día de la semana para una fecha YYYY-MM-DD.
 * Domingo = 0, lunes = 1, martes = 2...
 */
export function obtenerDiaSemana(fecha: string): number {
  const [anio, mes, dia] = fecha.split('-').map(Number)

  if (!anio || !mes || !dia) return -1

  return new Date(anio, mes - 1, dia, 12, 0, 0).getDay()
}