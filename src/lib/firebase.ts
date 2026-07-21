import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, isSupported, type Messaging } from "firebase/messaging";

export const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const CLAVE_VAPID = String(
  import.meta.env.VITE_FIREBASE_VAPID_KEY || ""
).trim();

const validarConfiguracion = () => {
  const faltantes = Object.entries(firebaseConfig)
    .filter(([, valor]) => !valor)
    .map(([campo]) => campo);

  if (faltantes.length > 0) {
    throw new Error(
      `Falta configurar Firebase en .env: ${faltantes.join(", ")}.`
    );
  }

  if (!CLAVE_VAPID) {
    throw new Error("Falta VITE_FIREBASE_VAPID_KEY en el archivo .env.");
  }
};

validarConfiguracion();

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const obtenerFirebaseMessaging = async (): Promise<Messaging | null> => {
  if (!(await isSupported())) {
    console.warn("Este navegador no es compatible con Firebase Messaging.");
    return null;
  }

  return getMessaging(firebaseApp);
};
