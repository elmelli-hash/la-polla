import { getToken } from "firebase/messaging";
import { CLAVE_VAPID, obtenerFirebaseMessaging } from "../lib/firebase";
import { supabase } from "../lib/supabase";

export type ResultadoActivacionNotificaciones = {
  exito: boolean;
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

    const registroServiceWorker = await registrarServiceWorkerFirebase();
    const messaging = await obtenerFirebaseMessaging();

    if (!messaging) {
      return {
        exito: false,
        mensaje: "Este navegador o dispositivo no es compatible con Firebase Messaging.",
      };
    }

    const token = await getToken(messaging, {
      vapidKey: CLAVE_VAPID,
      serviceWorkerRegistration: registroServiceWorker,
    });

    if (!token) {
      return { exito: false, mensaje: "Firebase no pudo generar el identificador del dispositivo." };
    }

    const { error } = await supabase.from("dispositivos_notificaciones").upsert(
      {
        usuario_id: usuarioId,
        token,
        navegador: navigator.userAgent,
        activo: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" }
    );

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
