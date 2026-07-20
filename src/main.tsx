import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './ErrorBoundary'

window.addEventListener('error', (event) => {
  const detalle =
    event.error?.stack ||
    event.error?.message ||
    event.message ||
    'Error desconocido'

  document.body.innerHTML = `
    <div style="
      background:#111;
      color:#ff6b6b;
      padding:20px;
      min-height:100vh;
      font-family:monospace;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
    ">
      ERROR JAVASCRIPT

      Mensaje:
      ${event.message}

      Detalle:
      ${detalle}

      Archivo:
      ${event.filename}

      Línea:
      ${event.lineno}:${event.colno}
    </div>
  `
})

window.addEventListener('unhandledrejection', (event) => {
  const motivo =
    event.reason?.stack ||
    event.reason?.message ||
    String(event.reason)

  document.body.innerHTML = `
    <div style="
      background:#111;
      color:#ff6b6b;
      padding:20px;
      min-height:100vh;
      font-family:monospace;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
    ">
      PROMESA RECHAZADA

      ${motivo}
    </div>
  `
})

const root = document.getElementById('root')

if (!root) {
  throw new Error('No se encontró el elemento root')
}

createRoot(root).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)