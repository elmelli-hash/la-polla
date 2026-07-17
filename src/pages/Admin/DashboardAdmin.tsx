import { useState } from "react";
import type { Jugada, Semana } from "../../types";

type Props = {
  cantidadUsuarios: number;
  cantidadJugadas: number;
  cantidadComprobantes: number;
  semanaActual?: Semana;
  jugadasGanadoras: Jugada[];
  nombreUsuario: (usuarioId: string) => string;
  tableroCompleto: string[];
  cantidadesSemanaActual: Record<string, number>;
  totalResultadosSemanaActual: number;
  onCambiarEstadoSemana: (semana: Semana) => void;
  onDeclararPozo: (semana: Semana) => void;
  procesandoPozo: boolean;
};

function DashboardAdmin({
  cantidadUsuarios,
  cantidadJugadas,
  cantidadComprobantes,
  semanaActual,
  jugadasGanadoras,
  nombreUsuario,
  tableroCompleto,
  cantidadesSemanaActual,
  totalResultadosSemanaActual,
  onCambiarEstadoSemana,
  onDeclararPozo,
  procesandoPozo,
}: Props) {
  const [mostrarCompartir, setMostrarCompartir] = useState(false);

  const formatoPozo = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  const compartirTexto = async (texto: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "LA POLLA", text: texto });
      } else {
        await navigator.clipboard.writeText(texto);
        window.alert("Texto copiado. Ya podés pegarlo en WhatsApp.");
      }
      setMostrarCompartir(false);
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      window.open(
        `https://wa.me/?text=${encodeURIComponent(texto)}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  };

  const textoResumen = () => {
    if (!semanaActual) return "🎯 LA POLLA\nNo hay una semana activa.";

    const estado =
      semanaActual.resultado === "vacante"
        ? "💰 Pozo vacante"
        : semanaActual.resultado === "finalizada"
          ? "🏆 Finalizada"
          : semanaActual.estado === "abierta"
            ? "🟢 Abierta"
            : "🔒 Cerrada";

    return [
      "🎯 LA POLLA",
      semanaActual.nombre,
      "",
      `Estado: ${estado}`,
      `Pozo acumulado: ${formatoPozo.format(semanaActual.pozo ?? 0)}`,
      `Jugadores: ${cantidadUsuarios}`,
      `Jugadas: ${cantidadJugadas}`,
      `Resultados cargados: ${totalResultadosSemanaActual}`,
      `Ganadores: ${jugadasGanadoras.length}`,
    ].join("\n");
  };

  const textoPozo = () => {
    if (!semanaActual) return "💰 LA POLLA\nNo hay una semana activa.";
    return [
      "💰 LA POLLA — POZO ACUMULADO",
      semanaActual.nombre,
      "",
      `Pozo: ${formatoPozo.format(semanaActual.pozo ?? 0)}`,
      semanaActual.resultado === "vacante"
        ? "Nadie logró los 10 aciertos. ¡El pozo sigue creciendo!"
        : "¡Participá por el pozo acumulado!",
    ].join("\n");
  };

  const textoTablero = () => {
    if (!semanaActual) return "🎯 LA POLLA\nNo hay una semana activa.";
    const salidos = tableroCompleto
      .filter((numero) => (cantidadesSemanaActual[numero] ?? 0) > 0)
      .map((numero) => {
        const cantidad = cantidadesSemanaActual[numero] ?? 0;
        return cantidad > 1 ? `${numero} x${cantidad}` : numero;
      });

    return [
      "🎯 LA POLLA — TABLERO SEMANAL",
      semanaActual.nombre,
      "",
      salidos.length > 0
        ? `Números salidos: ${salidos.join(" - ")}`
        : "Todavía no se cargaron resultados.",
      "",
      `Pozo acumulado: ${formatoPozo.format(semanaActual.pozo ?? 0)}`,
    ].join("\n");
  };

  return (
    <>
      {jugadasGanadoras.length > 0 && (
        <div className="ganadores-admin">
          <h2>Ganadores de la semana</h2>
          {jugadasGanadoras.map((jugada) => (
            <div key={jugada.id} className="ganador-admin-item">
              <strong>{nombreUsuario(jugada.usuario_id)}</strong>
              <span>Jugada #{jugada.numero_jugada}</span>
            </div>
          ))}
        </div>
      )}

      {semanaActual && (
        <section className="control-semana-dashboard">
          <div>
            <span>Estado de la semana</span>
            <strong className={semanaActual.estado === "abierta" ? "abierta" : "cerrada"}>
              {semanaActual.estado === "abierta" ? "🟢 ABIERTA" : "🔒 CERRADA"}
            </strong>
            <small>{semanaActual.nombre}</small>
          </div>

          <div className="acciones-control-semana">
            {semanaActual.resultado === "en_curso" && (
              <button
                className={semanaActual.estado === "abierta" ? "boton-cerrar-semana" : "boton-reabrir-semana"}
                onClick={() => onCambiarEstadoSemana(semanaActual)}
              >
                {semanaActual.estado === "abierta" ? "🔒 Cerrar semana" : "🔓 Reabrir semana"}
              </button>
            )}

            {semanaActual.estado === "cerrada" && semanaActual.resultado === "en_curso" && (
              <button
                className="boton-pozo-acumulado"
                disabled={procesandoPozo}
                onClick={() => onDeclararPozo(semanaActual)}
              >
                {procesandoPozo ? "Procesando..." : "💰 Declarar pozo acumulado"}
              </button>
            )}

            <div className="compartir-admin-contenedor">
              <button
                className="boton-compartir"
                type="button"
                onClick={() => setMostrarCompartir((actual) => !actual)}
              >
                📤 Compartir
              </button>

              {mostrarCompartir && (
                <div className="menu-compartir-admin">
                  <button type="button" onClick={() => compartirTexto(textoResumen())}>
                    📋 Resumen de la semana
                  </button>
                  <button type="button" onClick={() => compartirTexto(textoPozo())}>
                    💰 Pozo acumulado
                  </button>
                  <button type="button" onClick={() => compartirTexto(textoTablero())}>
                    🎯 Tablero y resultados
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="tarjetas">
        <div className="tarjeta"><span>👥</span><h3>Usuarios registrados</h3><strong>{cantidadUsuarios}</strong></div>
        <div className="tarjeta"><span>🎲</span><h3>Jugadas</h3><strong>{cantidadJugadas}</strong></div>
        <div className="tarjeta"><span>📎</span><h3>Comprobantes</h3><strong>{cantidadComprobantes}</strong></div>
        <div className="tarjeta">
          <span>📅</span><h3>Semana actual</h3>
          {semanaActual ? <><strong className={semanaActual.estado === "abierta" ? "abierta" : "cerrada"}>{semanaActual.estado === "abierta" ? "ABIERTA" : "CERRADA"}</strong><p>{semanaActual.nombre}</p></> : <strong className="cerrada">SIN SEMANAS</strong>}
        </div>
      </section>

      <section className="tablero-publico">
        <div className="tablero-encabezado">
          <div><h2>Tablero semanal</h2><p>{semanaActual ? semanaActual.nombre : "No hay semanas disponibles"}</p></div>
          <strong>{totalResultadosSemanaActual} resultados cargados</strong>
        </div>
        <div className="tablero-00-99">
          {tableroCompleto.map((numero) => {
            const cantidad = cantidadesSemanaActual[numero] ?? 0;
            return <div key={numero} className={cantidad > 0 ? "numero-tablero numero-tablero-salido" : "numero-tablero"}><span>{numero}</span>{cantidad > 0 && <small>x{cantidad}</small>}</div>;
          })}
</div>
      </section>
    </>
  );
}

export default DashboardAdmin;
