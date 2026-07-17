import type { Comprobante, Semana } from "../../types";

type Props = {
  semanaActual?: Semana;
  estadoPago?: Comprobante;
  pagoHabilitado: boolean;
  cantidadJugadas: number;
  maxJugadas: number;
  tableroCompleto: string[];
  cantidadesSemanaActual: Record<string, number>;
  totalResultadosSemanaActual: number;
};

function DashboardUsuario({
  semanaActual,
  estadoPago,
  pagoHabilitado,
  cantidadJugadas,
  maxJugadas,
  tableroCompleto,
  cantidadesSemanaActual,
  totalResultadosSemanaActual,
}: Props) {
  return (
    <>
      <section className="tarjetas">
        <div className="tarjeta">
          <span>🎲</span>
          <h3>Mis jugadas</h3>
          <strong>
            {cantidadJugadas} / {maxJugadas}
          </strong>
        </div>

        <div className="tarjeta">
          <span>📄</span>
          <h3>Comprobante</h3>
          <strong>
            {estadoPago?.estado === "aprobado" && "APROBADO"}
            {estadoPago?.estado === "pendiente" && "PENDIENTE"}
            {estadoPago?.estado === "rechazado" && "RECHAZADO"}
            {!estadoPago &&
              (pagoHabilitado ? "HABILITADO" : "SIN CARGAR")}
          </strong>
        </div>

        <div className="tarjeta">
          <span>📅</span>
          <h3>Semana actual</h3>

          {semanaActual ? (
            <>
              <strong
                className={
                  semanaActual.estado === "abierta"
                    ? "abierta"
                    : "cerrada"
                }
              >
                {semanaActual.estado === "abierta"
                  ? "ABIERTA"
                  : "CERRADA"}
              </strong>
              <p>{semanaActual.nombre}</p>
            </>
          ) : (
            <strong className="cerrada">SIN SEMANAS</strong>
          )}
        </div>
      </section>

      {semanaActual && (
        <section className="resumen-pago-dashboard">
          <h2>Estado de participación</h2>

          {semanaActual.estado === "cerrada" ? (
            <div className="participa-no">
              🔒 Semana cerrada — Solo consulta
            </div>
          ) : pagoHabilitado ? (
            <div className="participa-si">
              {estadoPago?.estado === "aprobado"
                ? "🟢 Pago aprobado — Participando"
                : "🟢 Habilitado por el administrador — Participando"}
            </div>
          ) : (
            <div className="participa-no">
              🔴 No habilitado para jugar
            </div>
          )}
        </section>
      )}

      <section className="tablero-publico">
        <div className="tablero-encabezado">
          <div>
            <h2>Tablero semanal</h2>
            <p>
              {semanaActual
                ? semanaActual.nombre
                : "No hay semanas disponibles"}
            </p>
          </div>

          <strong>
            {totalResultadosSemanaActual} resultados cargados
          </strong>
        </div>

        <div className="tablero-00-99">
          {tableroCompleto.map((numero) => {
            const veces = cantidadesSemanaActual[numero] ?? 0;

            return (
              <div
                key={numero}
                className={
                  veces > 0
                    ? "numero-tablero numero-tablero-salido"
                    : "numero-tablero"
                }
              >
                <span>{numero}</span>
                {veces > 0 && <small>× {veces}</small>}
              </div>
            );
          })}
</div>
      </section>
    </>
  );
}

export default DashboardUsuario;
