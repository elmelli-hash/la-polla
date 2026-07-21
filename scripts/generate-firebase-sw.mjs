import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const envPath = path.join(root, '.env')

function readEnv(file) {
  if (!fs.existsSync(file)) return {}
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=')
        const key = line.slice(0, index).trim()
        let value = line.slice(index + 1).trim()
        value = value.replace(/^['"]|['"]$/g, '')
        return [key, value]
      })
  )
}

const localEnv = readEnv(envPath)
const get = (key) => process.env[key] || localEnv[key] || ''

const config = {
  apiKey: get('VITE_FIREBASE_API_KEY'),
  authDomain: get('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: get('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: get('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: get('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: get('VITE_FIREBASE_APP_ID'),
}

const faltantes = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (faltantes.length) {
  console.warn(`Aviso: faltan variables Firebase para el Service Worker: ${faltantes.join(', ')}`)
}

const output = `/* Generado automáticamente por scripts/generate-firebase-sw.mjs */
/* global firebase, clients */

const firebaseConfig = ${JSON.stringify(config, null, 2)};
let messaging = null;

try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

  if (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId) {
    firebase.initializeApp(firebaseConfig);
    messaging = firebase.messaging();
  } else {
    console.error('Firebase SW: configuración incompleta. Revisá las variables VITE_FIREBASE_* en .env.');
  }
} catch (error) {
  console.error('Firebase SW: no se pudo iniciar Firebase Messaging.', error);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const notification = payload?.notification || {};
    const data = payload?.data || {};
    const title = notification.title || data.title || 'La Polla';
    const options = {
      body: notification.body || data.body || 'Tenés una nueva notificación.',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/icon-192.png',
      data: { url: data.url || '/' },
    };
    return self.registration.showNotification(title, options);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || '/';
  const urlDestino = new URL(destino, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const ventana of ventanas) {
        if (ventana.url.startsWith(self.location.origin)) {
          if ('navigate' in ventana) ventana.navigate(urlDestino);
          if ('focus' in ventana) return ventana.focus();
        }
      }
      return clients.openWindow(urlDestino);
    })
  );
});
`

fs.writeFileSync(path.join(root, 'public', 'firebase-messaging-sw.js'), output)
console.log('Service Worker de Firebase generado correctamente.')
