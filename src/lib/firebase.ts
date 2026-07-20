import { initializeApp } from "firebase/app";
import {
  getMessaging,
  isSupported,
  type Messaging,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDhjCILEDQmyMl-pqUd84aI55r5EU99An7s",
  authDomain: "la-polla-notificaciones.firebaseapp.com",
  projectId: "la-polla-notificaciones",
  storageBucket: "la-polla-notificaciones.firebasestorage.app",
  messagingSenderId: "312807602596",
  appId: "1:312807602596:web:2eaf6fe4c11c0c08e66931",
};

export const firebaseApp = initializeApp(firebaseConfig);

export const obtenerFirebaseMessaging = async (): Promise<Messaging | null> => {
  const compatible = await isSupported();

  if (!compatible) {
    console.warn("Este navegador no es compatible con las notificaciones push.");
    return null;
  }

  return getMessaging(firebaseApp);
};
