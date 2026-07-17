import { useEffect, useMemo, useState } from "react";
import type {
  Comprobante,
  Jugada,
  Semana,
  Usuario,
} from "../../types";

type Casillero = {
  numero: string;
  acertado: boolean;
};

type Props = {
  usuarioActual: Usuario;
  esAdmin: boolean;
  semanaAbierta?: Semana;
  usuarios: Usuario[];
  semanas: Semana[];
  jugadas: Jugada[];

  cargandoJugadas: boolean;
  mostrarNuevaJugada: boolean;
  usuarioJugada: string;
  semanaJugada: string;
  numeros: string[];
  mensajeJugada: string;
  guardandoJugada: boolean;
  jugadaEditando: Jugada | null;

  onMostrarNuevaJugada: () => void;
  onActualizar: () => void;
  onUsuarioJugadaChange: (valor: string) => void;
  onSemanaJugadaChange: (valor: string) => void;
  onNumeroChange: (indice: number, valor: string) => void;
  onGuardar: () => void;
  onGuardarDirecta: (numeros: string[]) => Promise<boolean>;
  onCancelar: () => void;
  onEditar: (jugada: Jugada) => void;
  onEliminar: (jugada: Jugada) => void;

  obtenerEstadoCasilleros: (jugada: Jugada) => Casillero[];
  jugadaEsGanadora: (jugada: Jugada) => boolean;
  nombreUsuario: (usuarioId: string) => string;
  nombreSemanaPorId: (semanaId: string) => string;
  pagoAprobado: (usuarioId: string, semanaId: string) => boolean;
  obtenerComprobante: (
    usuarioId: string,
    semanaId: string
  ) => Comprobante | undefined;
};

const crearCasillerosVacios = () =>
  Array.from({ length: 10 }, () => "");

const escaparXml = (valor: string | number) =>
  String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function JugadasPage({
  usuarioActual,
  esAdmin,
  semanaAbierta,
  usuarios,
  semanas,
  jugadas,
  cargandoJugadas,
  mostrarNuevaJugada,
  usuarioJugada,
  semanaJugada,
  numeros,
  mensajeJugada,
  guardandoJugada,
  jugadaEditando,
  onMostrarNuevaJugada,
  onActualizar,
  onUsuarioJugadaChange,
  onSemanaJugadaChange,
  onNumeroChange,
  onGuardar,
  onGuardarDirecta,
  onCancelar,
  onEditar,
  onEliminar,
  obtenerEstadoCasilleros,
  jugadaEsGanadora,
  nombreUsuario,
  nombreSemanaPorId,
  pagoAprobado,
  obtenerComprobante,
}: Props) {
  const [borradores, setBorradores] = useState<string[][]>([]);
  const [guardandoBorrador, setGuardandoBorrador] = useState<number | null>(
    null
  );
  const [semanasAbiertas, setSemanasAbiertas] = useState<Set<string>>(
    new Set()
  );

  const semanasOrdenadas = useMemo(
    () =>
      [...semanas].sort((a, b) =>
        b.fecha_inicio.localeCompare(a.fecha_inicio)
      ),
    [semanas]
  );

  const semanaActual = semanaAbierta ?? semanasOrdenadas[0];

  const jugadasActuales = semanaActual
    ? jugadas.filter((jugada) => jugada.semana_id === semanaActual.id)
    : [];

  const jugadasUsuarioActuales = semanaActual
    ? jugadasActuales.filter(
        (jugada) => jugada.usuario_id === usuarioActual.id
      )
    : [];

  const semanasAnteriores = semanasOrdenadas.filter(
    (semana) => semana.id !== semanaActual?.id
  );

  const estadoPagoUsuarioActual = semanaActual
    ? obtenerComprobante(usuarioActual.id, semanaActual.id)
    : undefined;

  const habilitadoParaJugar = semanaActual
    ? pagoAprobado(usuarioActual.id, semanaActual.id)
    : false;

  const faltantes =
    !esAdmin && semanaActual?.estado === "abierta" && habilitadoParaJugar
      ? Math.max(
          0,
          usuarioActual.max_jugadas_semana - jugadasUsuarioActuales.length
        )
      : 0;

  useEffect(() => {
    setBorradores(
      Array.from({ length: faltantes }, () => crearCasillerosVacios())
    );
  }, [faltantes, semanaActual?.id]);

  const actualizarBorrador = (
    indiceJugada: number,
    indiceNumero: number,
    valor: string
  ) => {
    const limpio = valor.replace(/\D/g, "").slice(0, 2);

    setBorradores((actuales) =>
      actuales.map((jugada, posicion) =>
        posicion === indiceJugada
          ? jugada.map((numero, indice) =>
              indice === indiceNumero ? limpio : numero
            )
          : jugada
      )
    );
  };

  const guardarBorrador = async (indice: number) => {
    setGuardandoBorrador(indice);
    const guardada = await onGuardarDirecta(borradores[indice]);

    if (guardada) {
      setBorradores((actuales) =>
        actuales.filter((_, posicion) => posicion !== indice)
      );
    }

    setGuardandoBorrador(null);
  };

  const alternarSemana = (semanaId: string) => {
    setSemanasAbiertas((actuales) => {
      const copia = new Set(actuales);
      if (copia.has(semanaId)) copia.delete(semanaId);
      else copia.add(semanaId);
      return copia;
    });
  };

  const exportarSemanaExcel = (semana: Semana) => {
    const jugadasSemana = jugadas
      .filter((jugada) => jugada.semana_id === semana.id)
      .sort((a, b) => {
        const nombreA = nombreUsuario(a.usuario_id).toLocaleLowerCase("es");
        const nombreB = nombreUsuario(b.usuario_id).toLocaleLowerCase("es");
        return (
          nombreA.localeCompare(nombreB, "es") ||
          a.numero_jugada - b.numero_jugada
        );
      });

    const participantes = new Set(
      jugadasSemana.map((jugada) => jugada.usuario_id)
    ).size;

    const filas = jugadasSemana
      .map((jugada) => {
        const usuario = usuarios.find(
          (item) => item.id === jugada.usuario_id
        );
        const casilleros = obtenerEstadoCasilleros(jugada);
        const numerosJugados = casilleros
          .map((casillero) => casillero.numero)
          .join(" - ");
        const aciertos = casilleros.filter(
          (casillero) => casillero.acertado
        ).length;
        const estado = jugadaEsGanadora(jugada)
          ? "GANADOR"
          : pagoAprobado(jugada.usuario_id, semana.id)
            ? "Participando"
            : "No habilitado";

        return `
          <Row>
            <Cell><Data ss:Type="String">${escaparXml(
              usuario?.nombre ?? nombreUsuario(jugada.usuario_id)
            )}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(
              usuario?.email ?? ""
            )}</Data></Cell>
            <Cell><Data ss:Type="Number">${jugada.numero_jugada}</Data></Cell>
            <Cell><Data ss:Type="String">${escaparXml(
              numerosJugados
            )}</Data></Cell>
            <Cell><Data ss:Type="Number">${aciertos}</Data></Cell>
            <Cell><Data ss:Type="String">${estado}</Data></Cell>
          </Row>`;
      })
      .join("");

    const moneda = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(semana.pozo ?? 0);

    const xml = `<?xml version="1.0"?>
      <?mso-application progid="Excel.Sheet"?>
      <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
        xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
        <Styles>
          <Style ss:ID="Titulo">
            <Font ss:Bold="1" ss:Size="16"/>
          </Style>
          <Style ss:ID="Encabezado">
            <Font ss:Bold="1"/>
            <Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/>
          </Style>
        </Styles>
        <Worksheet ss:Name="Jugadas">
          <Table>
            <Column ss:Width="150"/>
            <Column ss:Width="190"/>
            <Column ss:Width="65"/>
            <Column ss:Width="330"/>
            <Column ss:Width="70"/>
            <Column ss:Width="100"/>
            <Row><Cell ss:StyleID="Titulo"><Data ss:Type="String">${escaparXml(
              semana.nombre
            )}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Desde</Data></Cell><Cell><Data ss:Type="String">${semana.fecha_inicio}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Hasta</Data></Cell><Cell><Data ss:Type="String">${semana.fecha_fin}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Estado</Data></Cell><Cell><Data ss:Type="String">${semana.estado}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Pozo acumulado</Data></Cell><Cell><Data ss:Type="String">${escaparXml(
              moneda
            )}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Participantes</Data></Cell><Cell><Data ss:Type="Number">${participantes}</Data></Cell></Row>
            <Row><Cell><Data ss:Type="String">Cantidad de jugadas</Data></Cell><Cell><Data ss:Type="Number">${jugadasSemana.length}</Data></Cell></Row>
            <Row></Row>
            <Row ss:StyleID="Encabezado">
              <Cell><Data ss:Type="String">Nombre</Data></Cell>
              <Cell><Data ss:Type="String">Correo</Data></Cell>
              <Cell><Data ss:Type="String">Jugada</Data></Cell>
              <Cell><Data ss:Type="String">Números jugados</Data></Cell>
              <Cell><Data ss:Type="String">Aciertos</Data></Cell>
              <Cell><Data ss:Type="String">Estado</Data></Cell>
            </Row>
            ${filas}
          </Table>
        </Worksheet>
      </Workbook>`;

    const blob = new Blob([xml], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(blob);
    enlace.download = `Jugadas_${semana.nombre.replace(
      /[^a-zA-Z0-9_-]/g,
      "_"
    )}.xls`;
    enlace.click();
    URL.revokeObjectURL(enlace.href);
  };

  const compartirJugada = async (jugada: Jugada) => {
    const semana = semanas.find((item) => item.id === jugada.semana_id);
    const casilleros = obtenerEstadoCasilleros(jugada);
    const numerosTexto = casilleros.map((item) => item.numero).join(" - ");
    const aciertos = casilleros.filter((item) => item.acertado).length;
    const pozo = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(semana?.pozo ?? 0);

    const texto = [
      "🎯 LA POLLA",
      semana?.nombre ?? nombreSemanaPorId(jugada.semana_id),
      `Jugada #${jugada.numero_jugada}`,
      esAdmin ? nombreUsuario(jugada.usuario_id) : usuarioActual.nombre,
      "",
      numerosTexto,
      "",
      `Aciertos: ${aciertos}/10`,
      `Pozo acumulado: ${pozo}`,
      jugadaEsGanadora(jugada) ? "🏆 ¡GANADOR!" : "🍀 ¡Mucha suerte!",
    ].join("\n");

    try {
      if (navigator.share) {
        await navigator.share({ title: "LA POLLA", text: texto });
        return;
      }

      await navigator.clipboard.writeText(texto);
      window.alert("Jugada copiada. Ya podés pegarla en WhatsApp.");
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;

      const whatsapp = `https://wa.me/?text=${encodeURIComponent(texto)}`;
      window.open(whatsapp, "_blank", "noopener,noreferrer");
    }
  };

  const renderTarjeta = (jugada: Jugada, soloConsulta: boolean) => {
    const casilleros = obtenerEstadoCasilleros(jugada);
    const aciertos = casilleros.filter(
      (casillero) => casillero.acertado
    ).length;
    const esPropia = jugada.usuario_id === usuarioActual.id;

    return (
      <article className="tarjeta-jugada" key={jugada.id}>
        <div className="encabezado-jugada">
          <div>
            <h3>Jugada #{jugada.numero_jugada}</h3>
            {esAdmin && <p>{nombreUsuario(jugada.usuario_id)}</p>}
            <small>{nombreSemanaPorId(jugada.semana_id)}</small>
            <div className="contador-aciertos">
              {aciertos} acierto{aciertos === 1 ? "" : "s"}
            </div>
            {jugadaEsGanadora(jugada) && (
              <div className="insignia-ganador">¡GANADOR!</div>
            )}
          </div>

          <div className="acciones-jugada">
            <button
              className="boton-compartir"
              onClick={() => compartirJugada(jugada)}
            >
              📤 Compartir
            </button>

            {soloConsulta || (!esAdmin && !esPropia) ? (
              <span className="edicion-bloqueada">🔒 Solo consulta</span>
            ) : (
              <>
              <button
                className="boton-editar"
                onClick={() => onEditar(jugada)}
              >
                Editar
              </button>
              <button
                className="boton-desactivar"
                onClick={() => onEliminar(jugada)}
              >
                Eliminar
              </button>
              </>
            )}
          </div>
        </div>

        <div className="numeros-jugada">
          {casilleros.map((casillero, indice) => (
            <span
              key={indice}
              className={casillero.acertado ? "numero-acertado" : ""}
            >
              {casillero.numero}
            </span>
          ))}
        </div>
      </article>
    );
  };

  return (
    <section className="jugadas-seccion">
      <div className="barra-jugadas">
        {esAdmin && semanaActual?.estado === "abierta" && (
          <button className="boton-nuevo" onClick={onMostrarNuevaJugada}>
            ＋ Nueva jugada
          </button>
        )}

        {esAdmin && semanaActual && (
          <button
            className="boton-exportar"
            onClick={() => exportarSemanaExcel(semanaActual)}
          >
            📥 Exportar Excel
          </button>
        )}

        <button onClick={onActualizar}>Actualizar</button>
      </div>

      {!esAdmin && semanaActual && (
        <div className="resumen-cupo-jugadas">
          <div>
            <span>Jugadas permitidas</span>
            <strong>{usuarioActual.max_jugadas_semana}</strong>
          </div>
          <div>
            <span>Jugadas cargadas</span>
            <strong>{jugadasUsuarioActuales.length}</strong>
          </div>
          <div>
            <span>Disponibles</span>
            <strong>{faltantes}</strong>
          </div>
        </div>
      )}

      {!esAdmin && semanaActual && (
        <div
          className={`estado-pago-bloque ${
            estadoPagoUsuarioActual?.estado ?? "sin-comprobante"
          }`}
        >
          <strong>Estado del pago</strong>
          {!estadoPagoUsuarioActual && habilitadoParaJugar && (
            <p>🟢 Habilitado por el administrador.</p>
          )}
          {!estadoPagoUsuarioActual && !habilitadoParaJugar && (
            <p>🔴 Subí el comprobante para poder cargar tus jugadas.</p>
          )}
          {estadoPagoUsuarioActual?.estado === "pendiente" && (
            <p>🟡 Comprobante pendiente de aprobación.</p>
          )}
          {estadoPagoUsuarioActual?.estado === "rechazado" && (
            <p>🔴 Comprobante rechazado. Subí uno nuevo.</p>
          )}
          {estadoPagoUsuarioActual?.estado === "aprobado" && (
            <p>🟢 Pago aprobado.</p>
          )}
        </div>
      )}

      {!semanaActual && (
        <div className="aviso-semana-cerrada">
          No hay semanas disponibles.
        </div>
      )}

      {esAdmin && mostrarNuevaJugada && (
        <div className="formulario-jugada">
          <h2>{jugadaEditando ? "Modificar jugada" : "Nueva jugada"}</h2>

          <label>
            Usuario
            <select
              value={usuarioJugada}
              onChange={(e) => onUsuarioJugadaChange(e.target.value)}
            >
              <option value="">Seleccionar usuario</option>
              {usuarios
                .filter((item) => item.habilitado)
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} — {item.email}
                  </option>
                ))}
            </select>
          </label>

          <label>
            Semana
            <select
              value={semanaJugada}
              onChange={(e) => onSemanaJugadaChange(e.target.value)}
            >
              <option value="">Seleccionar semana</option>
              {semanas
                .filter((item) => item.estado === "abierta")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
            </select>
          </label>

          <div className="grilla-numeros">
            {numeros.map((numero, indice) => (
              <input
                key={indice}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="00"
                value={numero}
                onChange={(e) => onNumeroChange(indice, e.target.value)}
              />
            ))}
          </div>

          <div className="acciones-formulario">
            <button
              className="guardar"
              onClick={onGuardar}
              disabled={guardandoJugada}
            >
              {guardandoJugada ? "Guardando..." : "Guardar jugada"}
            </button>
            <button className="cancelar" onClick={onCancelar}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensajeJugada && <p className="mensaje-jugadas">{mensajeJugada}</p>}

      {cargandoJugadas ? (
        <p>Cargando jugadas...</p>
      ) : (
        <>
          <div className="encabezado-seccion-jugadas">
            <h2>{esAdmin ? "Jugadas de la semana actual" : "Mis jugadas"}</h2>
            {semanaActual && <span>{semanaActual.nombre}</span>}
          </div>

          <div className="lista-jugadas">
            {(esAdmin ? jugadasActuales : jugadasUsuarioActuales).map(
              (jugada) =>
                renderTarjeta(
                  jugada,
                  semanaActual?.estado !== "abierta"
                )
            )}

            {!esAdmin && borradores.map((borrador, indiceJugada) => (
              <article
                className="formulario-jugada jugada-directa"
                key={`borrador-${indiceJugada}`}
              >
                <h3>
                  Jugada #{jugadasUsuarioActuales.length + indiceJugada + 1}
                </h3>
                <div className="grilla-numeros">
                  {borrador.map((numero, indiceNumero) => (
                    <input
                      key={indiceNumero}
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="00"
                      value={numero}
                      onChange={(e) =>
                        actualizarBorrador(
                          indiceJugada,
                          indiceNumero,
                          e.target.value
                        )
                      }
                    />
                  ))}
                </div>
                <p>Se permiten números repetidos.</p>
                <button
                  className="guardar"
                  disabled={guardandoBorrador !== null}
                  onClick={() => guardarBorrador(indiceJugada)}
                >
                  {guardandoBorrador === indiceJugada
                    ? "Guardando..."
                    : `Guardar jugada #${
                        jugadasUsuarioActuales.length + indiceJugada + 1
                      }`}
                </button>
              </article>
            ))}

            {(esAdmin ? jugadasActuales : jugadasUsuarioActuales).length ===
              0 &&
              borradores.length === 0 && (
                <div className="seccion-pendiente">
                  No hay jugadas en la semana actual.
                </div>
              )}
          </div>

          <section className="jugadas-anteriores">
            <h2>Anteriores</h2>

            {semanasAnteriores.map((semana) => {
              const jugadasSemana = jugadas.filter(
                (jugada) =>
                  jugada.semana_id === semana.id &&
                  (esAdmin || jugada.usuario_id === usuarioActual.id)
              );

              if (jugadasSemana.length === 0) return null;

              const abierta = semanasAbiertas.has(semana.id);

              return (
                <div className="grupo-semana-anterior" key={semana.id}>
                  <div className="cabecera-semana-anterior">
                    <button onClick={() => alternarSemana(semana.id)}>
                      {abierta ? "▼" : "▶"} {semana.nombre}
                    </button>

                    <span>
                      {semana.fecha_inicio} al {semana.fecha_fin} — {" "}
                      {jugadasSemana.length} jugada
                      {jugadasSemana.length === 1 ? "" : "s"}
                    </span>

                    {esAdmin && (
                      <button
                        className="boton-exportar-compacto"
                        onClick={() => exportarSemanaExcel(semana)}
                      >
                        📥 Excel
                      </button>
                    )}
                  </div>

                  {abierta && (
                    <div className="lista-jugadas historial-consulta">
                      {jugadasSemana.map((jugada) =>
                        renderTarjeta(jugada, true)
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}
    </section>
  );
}

export default JugadasPage;
