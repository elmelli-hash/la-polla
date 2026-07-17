import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

type Usuario = {
  id?: string;
  nombre: string;
  email: string;
  rol: "admin" | "usuario";
  habilitado: boolean;
};

type Semana = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "abierta" | "cerrada";
};

type Jugada = {
  id: string;
  usuario_id: string;
  semana_id: string;
  numero_jugada: number;
  n1: string;
  n2: string;
  n3: string;
  n4: string;
  n5: string;
  n6: string;
  n7: string;
  n8: string;
  n9: string;
  n10: string;
  bloqueada: boolean;
  created_at?: string;
  usuario?: {
    nombre: string;
    email: string;
  } | null;
  semana?: {
    nombre: string;
    estado: string;
  } | null;
};

type Props = {
  usuarioActual: Usuario;
};

const crearNumerosVacios = () =>
  Array.from({ length: 10 }, () => "");

function Jugadas({ usuarioActual }: Props) {
  const [jugadas, setJugadas] = useState<Jugada[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [semanas, setSemanas] = useState<Semana[]>([]);

  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState("");
  const [semanaSeleccionada, setSemanaSeleccionada] = useState("");
  const [numeros, setNumeros] = useState<string[]>(crearNumerosVacios());

  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const esAdmin = usuarioActual.rol === "admin";

  const semanaAbierta = useMemo(
    () => semanas.find((semana) => semana.estado === "abierta"),
    [semanas]
  );

  const cargarDatos = async () => {
    setCargando(true);
    setMensaje("");

    const consultaJugadas = supabase
      .from("jugadas")
      .select(`
        id,
        usuario_id,
        semana_id,
        numero_jugada,
        n1,
        n2,
        n3,
        n4,
        n5,
        n6,
        n7,
        n8,
        n9,
        n10,
        bloqueada,
        created_at,
        usuario:usuarios (
          nombre,
          email
        ),
        semana:semanas (
          nombre,
          estado
        )
      `)
      .order("created_at", { ascending: false });

    if (!esAdmin && usuarioActual.id) {
      consultaJugadas.eq("usuario_id", usuarioActual.id);
    }

    const [
      { data: datosJugadas, error: errorJugadas },
      { data: datosSemanas, error: errorSemanas },
      { data: datosUsuarios, error: errorUsuarios },
    ] = await Promise.all([
      consultaJugadas,
      supabase
        .from("semanas")
        .select("id, nombre, fecha_inicio, fecha_fin, estado")
        .order("fecha_inicio", { ascending: false }),
      esAdmin
        ? supabase
            .from("usuarios")
            .select("id, nombre, email, rol, habilitado")
            .eq("habilitado", true)
            .order("nombre", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (errorJugadas) {
      setMensaje("No se pudieron cargar las jugadas: " + errorJugadas.message);
      setCargando(false);
      return;
    }

    if (errorSemanas) {
      setMensaje("No se pudieron cargar las semanas: " + errorSemanas.message);
      setCargando(false);
      return;
    }

    if (errorUsuarios) {
      setMensaje("No se pudieron cargar los usuarios: " + errorUsuarios.message);
      setCargando(false);
      return;
    }

    setJugadas((datosJugadas ?? []) as unknown as Jugada[]);
    setSemanas((datosSemanas ?? []) as Semana[]);
    setUsuarios((datosUsuarios ?? []) as Usuario[]);

    const abierta = (datosSemanas ?? []).find(
      (semana: Semana) => semana.estado === "abierta"
    );

    if (abierta) {
      setSemanaSeleccionada(abierta.id);
    }

    if (!esAdmin && usuarioActual.id) {
      setUsuarioSeleccionado(usuarioActual.id);
    }

    setCargando(false);
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const cambiarNumero = (indice: number, valor: string) => {
    const soloDigitos = valor.replace(/\D/g, "").slice(0, 2);

    setNumeros((actuales) =>
      actuales.map((numero, posicion) =>
        posicion === indice ? soloDigitos : numero
      )
    );
  };

  const validarNumeros = () => {
    if (numeros.some((numero) => numero.length === 0)) {
      setMensaje("Completá los 10 números.");
      return false;
    }

    const normalizados = numeros.map((numero) =>
      numero.padStart(2, "0")
    );

    const fueraDeRango = normalizados.some((numero) => {
      const valor = Number(numero);
      return Number.isNaN(valor) || valor < 0 || valor > 99;
    });

    if (fueraDeRango) {
      setMensaje("Todos los números deben estar entre 00 y 99.");
      return false;
    }

    const repetidos = new Set(normalizados).size !== normalizados.length;

    if (repetidos) {
      setMensaje("No se pueden repetir números dentro de la misma jugada.");
      return false;
    }

    setNumeros(normalizados);
    return true;
  };

  const guardarJugada = async () => {
    setMensaje("");

    const usuarioId = esAdmin
      ? usuarioSeleccionado
      : usuarioActual.id ?? "";

    if (!usuarioId) {
      setMensaje("Seleccioná un usuario.");
      return;
    }

    if (!semanaSeleccionada) {
      setMensaje("No hay una semana seleccionada.");
      return;
    }

    const semana = semanas.find(
      (item) => item.id === semanaSeleccionada
    );

    if (!semana || semana.estado !== "abierta") {
      setMensaje("La semana está cerrada. No se pueden cargar jugadas.");
      return;
    }

    if (!validarNumeros()) return;

    setGuardando(true);

    const { count, error: errorConteo } = await supabase
      .from("jugadas")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuarioId)
      .eq("semana_id", semanaSeleccionada);

    if (errorConteo) {
      setMensaje("No se pudo calcular el número de jugada.");
      setGuardando(false);
      return;
    }

    const numeroJugada = (count ?? 0) + 1;
    const valores = numeros.map((numero) => numero.padStart(2, "0"));

    const { error } = await supabase.from("jugadas").insert({
      usuario_id: usuarioId,
      semana_id: semanaSeleccionada,
      numero_jugada: numeroJugada,
      n1: valores[0],
      n2: valores[1],
      n3: valores[2],
      n4: valores[3],
      n5: valores[4],
      n6: valores[5],
      n7: valores[6],
      n8: valores[7],
      n9: valores[8],
      n10: valores[9],
      bloqueada: true,
    });

    if (error) {
      setMensaje("No se pudo guardar la jugada: " + error.message);
      setGuardando(false);
      return;
    }

    setNumeros(crearNumerosVacios());
    setMostrarFormulario(false);
    setMensaje("Jugada guardada correctamente.");
    setGuardando(false);

    await cargarDatos();
  };

  const eliminarJugada = async (jugada: Jugada) => {
    if (!esAdmin) return;

    const confirmar = window.confirm(
      `¿Eliminar la jugada número ${jugada.numero_jugada}?`
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("jugadas")
      .delete()
      .eq("id", jugada.id);

    if (error) {
      setMensaje("No se pudo eliminar la jugada: " + error.message);
      return;
    }

    await cargarDatos();
  };

  const numerosDeJugada = (jugada: Jugada) => [
    jugada.n1,
    jugada.n2,
    jugada.n3,
    jugada.n4,
    jugada.n5,
    jugada.n6,
    jugada.n7,
    jugada.n8,
    jugada.n9,
    jugada.n10,
  ];

  return (
    <section className="jugadas-seccion">
      <div className="barra-jugadas">
        <button
          className="boton-nuevo"
          onClick={() => {
            setMostrarFormulario(true);
            setMensaje("");
          }}
          disabled={!semanaAbierta}
        >
          ＋ Nueva jugada
        </button>

        <button onClick={cargarDatos}>Actualizar</button>
      </div>

      {!semanaAbierta && (
        <div className="aviso-semana-cerrada">
          No hay ninguna semana abierta. No se pueden cargar jugadas.
        </div>
      )}

      {mostrarFormulario && (
        <div className="formulario-jugada">
          <h2>Nueva jugada</h2>

          {esAdmin && (
            <label>
              Usuario
              <select
                value={usuarioSeleccionado}
                onChange={(e) =>
                  setUsuarioSeleccionado(e.target.value)
                }
              >
                <option value="">Seleccionar usuario</option>

                {usuarios.map((usuario) => (
                  <option
                    key={usuario.id ?? usuario.email}
                    value={usuario.id}
                  >
                    {usuario.nombre} — {usuario.email}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label>
            Semana
            <select
              value={semanaSeleccionada}
              onChange={(e) =>
                setSemanaSeleccionada(e.target.value)
              }
            >
              <option value="">Seleccionar semana</option>

              {semanas
                .filter((semana) => semana.estado === "abierta")
                .map((semana) => (
                  <option key={semana.id} value={semana.id}>
                    {semana.nombre}
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
                onChange={(e) =>
                  cambiarNumero(indice, e.target.value)
                }
                onBlur={() => {
                  if (numero !== "") {
                    cambiarNumero(indice, numero.padStart(2, "0"));
                  }
                }}
              />
            ))}
          </div>

          <p className="ayuda-jugada">
            Ingresá 10 números diferentes entre 00 y 99.
          </p>

          <div className="acciones-formulario">
            <button
              className="guardar"
              onClick={guardarJugada}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar jugada"}
            </button>

            <button
              className="cancelar"
              onClick={() => {
                setMostrarFormulario(false);
                setNumeros(crearNumerosVacios());
                setMensaje("");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {mensaje && <p className="mensaje-jugadas">{mensaje}</p>}

      {cargando ? (
        <p>Cargando jugadas...</p>
      ) : (
        <div className="lista-jugadas">
          {jugadas.map((jugada) => (
            <article className="tarjeta-jugada" key={jugada.id}>
              <div className="encabezado-jugada">
                <div>
                  <h3>Jugada #{jugada.numero_jugada}</h3>

                  {esAdmin && (
                    <p>
                      {jugada.usuario?.nombre ?? "Usuario"}
                      {" — "}
                      {jugada.usuario?.email ?? ""}
                    </p>
                  )}

                  <small>
                    {jugada.semana?.nombre ?? "Semana"}
                  </small>
                </div>

                <span
                  className={
                    jugada.semana?.estado === "abierta"
                      ? "estado activo"
                      : "estado inactivo"
                  }
                >
                  {jugada.semana?.estado === "abierta"
                    ? "Semana abierta"
                    : "Semana cerrada"}
                </span>
              </div>

              <div className="numeros-jugada">
                {numerosDeJugada(jugada).map((numero, indice) => (
                  <span key={`${jugada.id}-${indice}`}>
                    {numero}
                  </span>
                ))}
              </div>

              {esAdmin && (
                <div className="acciones-jugada">
                  <button
                    className="boton-desactivar"
                    onClick={() => eliminarJugada(jugada)}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </article>
          ))}

          {jugadas.length === 0 && (
            <div className="seccion-pendiente">
              Todavía no hay jugadas cargadas.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default Jugadas;