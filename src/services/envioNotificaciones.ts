import { supabase } from "../lib/supabase";

export type DestinoNotificacion = "todos" | "usuarios" | "administradores";

export type SolicitudNotificacion = {
  titulo: string;
  mensaje: string;
  destino: DestinoNotificacion;
  url?: string;
};

export type ResultadoEnvioNotificacion = {
  exito: boolean;
  mensaje: string;
  enviados?: number;
  fallidos?: number;
};

export const enviarNotificacionJugadores = async (
  solicitud: SolicitudNotificacion
): Promise<ResultadoEnvioNotificacion> => {
  const { data, error } = await supabase.functions.invoke(
    "enviar-notificacion",
    { body: solicitud }
  );

  if (error) {
    return {
      exito: false,
      mensaje: `No se pudo enviar la notificación: ${error.message}`,
    };
  }

  if (!data?.exito) {
    return {
      exito: false,
      mensaje: data?.mensaje ?? "La función no pudo enviar la notificación.",
    };
  }

  return {
    exito: true,
    mensaje: data.mensaje ?? "Notificación enviada correctamente.",
    enviados: Number(data.enviados ?? 0),
    fallidos: Number(data.fallidos ?? 0),
  };
};
