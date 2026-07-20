import { getToken } from "firebase/messaging";
import { obtenerFirebaseMessaging } from "../lib/firebase";
import { supabase } from "../lib/supabase";

const CLAVE_VAPID ="BEzstjVjFfs117QJZP9JvQIQdKoei4-O6MejUxmLHgmMTraQdstTk0iQv5wYmN2AgIFtrzbC383VYoiWvO-WuEg";

export type ResultadoActivacionNotificaciones = {
  exito: boolean;
  mensaje: string;
};

export const activarNotificacionesPush = async (
  usuarioId: string
): Promise<ResultadoActivacionNotificaciones> => {
  try {
    if (!("Notification" in window)) {
      return { exito: false, mensaje: "Este navegador no admite notificaciones." };
    }

    if (!("serviceWorker" in navigator)) {
      return {
        exito: false,
        mensaje: "Este navegador no admite notificaciones en segundo plano.",
      };
    }

    const permiso = await Notification.requestPermission();

    if (permiso === "denied") {
      return {
        exito: false,
        mensaje:
          "Las notificaciones están bloqueadas. Habilitalas desde la configuración de Chrome.",
      };
    }

    if (permiso !== "granted") {
      return {
        exito: false,
        mensaje: "No se concedió el permiso para enviar notificaciones.",
      };
    }

    const registroServiceWorker = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    await navigator.serviceWorker.ready;

    const messaging = await obtenerFirebaseMessaging();

    if (!messaging) {
      return {
        exito: false,
        mensaje: "Este navegador no es compatible con Firebase Messaging.",
      };
    }

    const token = await getToken(messaging, {
      vapidKey: CLAVE_VAPID,
      serviceWorkerRegistration: registroServiceWorker,
    });

    if (!token) {
      return {
        exito: false,
        mensaje: "Firebase no pudo identificar este dispositivo.",
      };
    }

    const { error } = await supabase
      .from("dispositivos_notificaciones")
      .upsert(
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
        mensaje:
          "Se obtuvo el permiso, pero no se pudo registrar el dispositivo: " +
          error.message,
      };
    }

    return {
      exito: true,
      mensaje: "Notificaciones activadas correctamente en este dispositivo.",
    };
  } catch (error) {
    console.error("Error activando notificaciones:", error);

    return {
      exito: false,
      mensaje:
        error instanceof Error
          ? "No se pudieron activar las notificaciones: " + error.message
          : "No se pudieron activar las notificaciones.",
    };
  }
};
