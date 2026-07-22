import { getToken } from "firebase/messaging";
import { CLAVE_VAPID, obtenerFirebaseMessaging } from "../lib/firebase";
import { supabase } from "../lib/supabase";

export type ResultadoActivacionNotificaciones = {
  exito: boolean;
  mensaje: string;
};

export type EstadoNotificaciones =
  | "comprobando"
  | "activadas"
  | "desactivadas"
  | "bloqueadas"
  | "no_disponibles";

export type ResultadoEstadoNotificaciones = {
  estado: EstadoNotificaciones;
  mensaje: string;
};

const registrarServiceWorkerFirebase = async () => {
  const registro = await navigator.serviceWorker.register(
    "/firebase-messaging-sw.js",
    { scope: "/", updateViaCache: "none" }
  );

  await registro.update();
  return registro;
};

const obtenerTokenActual = async () => {
  const registroServiceWorker = await registrarServiceWorkerFirebase();
  const messaging = await obtenerFirebaseMessaging();

  if (!messaging) return null;

  return getToken(messaging, {
    vapidKey: CLAVE_VAPID,
    serviceWorkerRegistration: registroServiceWorker,
  });
};

const mensajeFirebaseAmigable = (error: unknown) => {
  const detalle = error instanceof Error ? error.message : String(error);

  if (detalle.includes("API key not valid") || detalle.includes("api-key-not-valid")) {
    return "La API key de Firebase no coincide con la aplicación web. Copiá nuevamente el bloque Config desde Firebase y reemplazá VITE_FIREBASE_API_KEY en .env.";
  }

  if (
    detalle.includes("applicationServerKey is not valid") ||
    detalle.includes("provided applicationServerKey") ||
    detalle.includes("atob") ||
    detalle.includes("invalid-vapid-key")
  ) {
    return "La clave VAPID no es válida. Copiala desde Firebase > Cloud Messaging > Certificados push web y reemplazá VITE_FIREBASE_VAPID_KEY en .env.";
  }

  if (detalle.includes("ServiceWorker script evaluation failed")) {
    return "Chrome no pudo iniciar el servicio de notificaciones. Publicá esta versión, borrá los datos del sitio y volvé a intentarlo.";
  }

  return "No se pudieron activar las notificaciones: " + detalle;
};

export const comprobarEstadoNotificaciones = async (
  usuarioId: string
): Promise<ResultadoEstadoNotificaciones> => {
  try {
    if (!window.isSecureContext) {
      return {
        estado: "no_disponibles",
        mensaje: "Las notificaciones requieren HTTPS.",
      };
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return {
        estado: "no_disponibles",
        mensaje: "Este navegador no admite notificaciones push.",
      };
    }

    if (Notification.permission === "denied") {
      return {
        estado: "bloqueadas",
        mensaje: "Las notificaciones están bloqueadas en Chrome.",
      };
    }

    if (Notification.permission !== "granted") {
      return { estado: "desactivadas", mensaje: "Notificaciones desactivadas." };
    }

    const token = await obtenerTokenActual();

    if (!token) {
      return {
        estado: "desactivadas",
        mensaje: "Este dispositivo todavía no está registrado.",
      };
    }

    const { data, error } = await supabase
      .from("dispositivos_notificaciones")
      .select("token, activo")
      .eq("usuario_id", usuarioId)
      .eq("token", token)
      .eq("activo", true)
      .maybeSingle();

    if (error) {
      console.error("Error comprobando notificaciones:", error);
      return {
        estado: "desactivadas",
        mensaje: "No se pudo comprobar el dispositivo.",
      };
    }

    if (!data) {
      return {
        estado: "desactivadas",
        mensaje: "Este dispositivo todavía no está registrado.",
      };
    }

    // Mantiene actualizada la última actividad sin crear filas duplicadas.
    const { error: errorActualizacion } = await supabase
      .from("dispositivos_notificaciones")
      .update({ updated_at: new Date().toISOString(), activo: true })
      .eq("usuario_id", usuarioId)
      .eq("token", token);

    if (errorActualizacion) {
      console.warn("No se pudo actualizar la última actividad:", errorActualizacion);
    }

    return {
      estado: "activadas",
      mensaje: "Notificaciones activadas en este dispositivo.",
    };
  } catch (error) {
    console.error("Error comprobando notificaciones:", error);
    return {
      estado: "desactivadas",
      mensaje: "No se pudo comprobar el estado de las notificaciones.",
    };
  }
};

export const activarNotificacionesPush = async (
  usuarioId: string
): Promise<ResultadoActivacionNotificaciones> => {
  try {
    if (!window.isSecureContext) {
      return {
        exito: false,
        mensaje: "Las notificaciones requieren HTTPS. Probalo desde Vercel o localhost.",
      };
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      return { exito: false, mensaje: "Este navegador no admite notificaciones push." };
    }

    const permiso = await Notification.requestPermission();

    if (permiso === "denied") {
      return {
        exito: false,
        mensaje: "Las notificaciones están bloqueadas. Habilitalas desde la configuración del sitio en Chrome.",
      };
    }

    if (permiso !== "granted") {
      return { exito: false, mensaje: "No se concedió el permiso para recibir notificaciones." };
    }

    const token = await obtenerTokenActual();

    if (!token) {
      return { exito: false, mensaje: "Firebase no pudo generar el identificador del dispositivo." };
    }

    const datosDispositivo = {
      usuario_id: usuarioId,
      token,
      navegador: navigator.userAgent,
      activo: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("dispositivos_notificaciones")
      .upsert(datosDispositivo, {
        onConflict: "token",
      });

    if (error) {
      return {
        exito: false,
        mensaje: "Chrome quedó autorizado, pero no se pudo guardar el dispositivo en Supabase: " + error.message,
      };
    }

    return { exito: true, mensaje: "Notificaciones activadas correctamente en este dispositivo." };
  } catch (error) {
    console.error("Error activando notificaciones:", error);
    return { exito: false, mensaje: mensajeFirebaseAmigable(error) };
  }
};
