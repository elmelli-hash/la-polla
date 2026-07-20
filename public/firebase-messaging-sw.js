/* Firebase Cloud Messaging - notificaciones en segundo plano */
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhjClEDQmyMl-pqUd84aI55r5EU99An7s",
  authDomain: "la-polla-notificaciones.firebaseapp.com",
  projectId: "la-polla-notificaciones",
  storageBucket: "la-polla-notificaciones.firebasestorage.app",
  messagingSenderId: "312807602596",
  appId: "1:312807602596:web:2eaf6fe4c11c0c08e66931"
};

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || payload.data?.title || "La Polla";
  const opciones = {
    body:
      payload.notification?.body ||
      payload.data?.body ||
      "Tenés una nueva notificación.",
    icon: "/icons.svg",
    badge: "/icons.svg",
    data: { url: payload.data?.url || "/" },
  };

  self.registration.showNotification(titulo, opciones);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((ventanas) => {
        for (const ventana of ventanas) {
          if ("focus" in ventana) {
            ventana.navigate(destino);
            return ventana.focus();
          }
        }
        return clients.openWindow(destino);
      })
  );
});
