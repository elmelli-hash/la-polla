import { useMemo, useState } from "react";
import {
  enviarNotificacionJugadores,
  type DestinoNotificacion,
} from "../../services/envioNotificaciones";

type Plantilla = {
  nombre: string;
  titulo: string;
  mensaje: string;
};

const plantillas: Plantilla[] = [
  {
    nombre: "Semana abierta",
    titulo: "Nueva semana disponible",
    mensaje: "Ya podés ingresar a La Polla y cargar tus jugadas.",
  },
  {
    nombre: "Números cargados",
    titulo: "Nuevos números cargados",
    mensaje: "Ya se actualizaron los números salidos. Revisá tus aciertos.",
  },
  {
    nombre: "Comprobante pendiente",
    titulo: "Recordatorio de comprobante",
    mensaje: "Recordá subir tu comprobante para quedar habilitado esta semana.",
  },
  {
    nombre: "Cierre próximo",
    titulo: "La semana está por cerrar",
    mensaje: "Falta poco para el cierre. Verificá que tus jugadas estén cargadas.",
  },
  {
    nombre: "Pozo actualizado",
    titulo: "Pozo acumulado actualizado",
    mensaje: "Ingresá a La Polla para consultar el nuevo monto del pozo.",
  },
  {
    nombre: "Ganador",
    titulo: "¡Tenemos ganador!",
    mensaje: "Ingresá a La Polla para ver el resultado de la semana.",
  },
];

function NotificacionesAdmin() {
  const [titulo, setTitulo] = useState(plantillas[0].titulo);
  const [mensaje, setMensaje] = useState(plantillas[0].mensaje);
  const [destino, setDestino] = useState<DestinoNotificacion>("usuarios");
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState("");

  const caracteres = useMemo(() => mensaje.trim().length, [mensaje]);

  const elegirPlantilla = (plantilla: Plantilla) => {
    setTitulo(plantilla.titulo);
    setMensaje(plantilla.mensaje);
    setResultado("");
  };

  const enviar = async () => {
    const tituloLimpio = titulo.trim();
    const mensajeLimpio = mensaje.trim();

    if (!tituloLimpio || !mensajeLimpio) {
      setResultado("Completá el título y el mensaje.");
      return;
    }

    if (tituloLimpio.length > 80) {
      setResultado("El título no puede superar los 80 caracteres.");
      return;
    }

    if (mensajeLimpio.length > 240) {
      setResultado("El mensaje no puede superar los 240 caracteres.");
      return;
    }

    const confirmar = window.confirm(
      `¿Enviar esta notificación a ${
        destino === "usuarios"
          ? "todos los jugadores"
          : destino === "administradores"
            ? "los administradores"
            : "todos los dispositivos"
      }?`
    );

    if (!confirmar) return;

    setEnviando(true);
    setResultado("Enviando notificación...");

    const respuesta = await enviarNotificacionJugadores({
      titulo: tituloLimpio,
      mensaje: mensajeLimpio,
      destino,
      url: "/",
    });

    setEnviando(false);

    if (!respuesta.exito) {
      setResultado(respuesta.mensaje);
      return;
    }

    setResultado(
      `${respuesta.mensaje} Enviadas: ${respuesta.enviados ?? 0}. Fallidas: ${respuesta.fallidos ?? 0}.`
    );
  };

  return (
    <section className="notificaciones-admin">
      <div className="notificaciones-intro">
        <h2>Enviar notificaciones</h2>
        <p>
          Elegí un aviso preparado o escribí uno personalizado. Solo recibirán
          el mensaje los dispositivos que hayan activado las notificaciones.
        </p>
      </div>

      <div className="plantillas-notificaciones">
        {plantillas.map((plantilla) => (
          <button
            type="button"
            key={plantilla.nombre}
            onClick={() => elegirPlantilla(plantilla)}
          >
            {plantilla.nombre}
          </button>
        ))}
      </div>

      <div className="formulario-notificacion">
        <label>
          Destinatarios
          <select
            value={destino}
            onChange={(e) => setDestino(e.target.value as DestinoNotificacion)}
          >
            <option value="usuarios">Todos los jugadores</option>
            <option value="todos">Jugadores y administradores</option>
            <option value="administradores">Solo administradores</option>
          </select>
        </label>

        <label>
          Título
          <input
            type="text"
            maxLength={80}
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
        </label>

        <label>
          Mensaje
          <textarea
            rows={5}
            maxLength={240}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
          <small>{caracteres}/240 caracteres</small>
        </label>

        <div className="vista-previa-notificacion">
          <span>Vista previa</span>
          <strong>{titulo || "Título de la notificación"}</strong>
          <p>{mensaje || "Mensaje de la notificación"}</p>
        </div>

        <button
          type="button"
          className="boton-enviar-notificacion"
          onClick={enviar}
          disabled={enviando}
        >
          {enviando ? "Enviando..." : "🔔 Enviar notificación"}
        </button>

        {resultado && (
          <div className="resultado-notificacion" role="status">
            {resultado}
          </div>
        )}
      </div>
    </section>
  );
}

export default NotificacionesAdmin;
