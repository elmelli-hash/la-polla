import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

window.addEventListener('error', (event) => {
  document.body.innerHTML = `
    <div style="
      background:#111;
      color:#ff6b6b;
      padding:20px;
      min-height:100vh;
      font-family:monospace;
      white-space:pre-wrap;
    ">
      ERROR JAVASCRIPT

      ${event.message}

      Archivo:
      ${event.filename}

      Línea:
      ${event.lineno}:${event.colno}
    </div>
  `
})

window.addEventListener('unhandledrejection', (event) => {
  document.body.innerHTML = `
    <div style="
      background:#111;
      color:#ff6b6b;
      padding:20px;
      min-height:100vh;
      font-family:monospace;
      white-space:pre-wrap;
    ">
      PROMESA RECHAZADA

      ${String(event.reason?.stack || event.reason)}
    </div>
  `
})
createRoot(document.getElementById('root')!).render(
  <App />
)
