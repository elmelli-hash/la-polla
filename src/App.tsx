import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { supabase } from "./lib/supabase";
import "./App.css";
import type {
  AutorizacionJuego,
  Comprobante,
  Jugada,
  NumeroSalido,
  Seccion,
  Semana,
  Usuario,
} from "./types";
import { numerosVacios } from "./utils/juego";
import {
  activarNotificacionesPush,
  comprobarEstadoNotificaciones,
  type EstadoNotificaciones,
} from "./services/notificaciones";
import DashboardAdmin from "./pages/Admin/DashboardAdmin";
import DashboardUsuario from "./pages/Usuario/DashboardUsuario";
import UsuariosAdmin from "./pages/Admin/UsuariosAdmin";
import NotificacionesAdmin from "./pages/Admin/NotificacionesAdmin";
import JugadasPage from "./pages/Compartido/JugadasPage";

const ZONA_HORARIA_ARGENTINA = "America/Argentina/Buenos_Aires";

const formatearFecha = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";

  const [anio, mes, dia] = fecha.slice(0, 10).split("-");

  if (!anio || !mes || !dia) return fecha;

  return `${dia.padStart(2, "0")}/${mes.padStart(2, "0")}/${anio}`;
};

const formatearFechaHora = (fecha?: string | null) => {
  if (!fecha) return "Sin fecha";

  // Los timestamps de Supabase se guardan en UTC.
  // Esta conversión aplica UTC-3 manualmente para que el resultado no
  // dependa de cómo Chrome interprete la zona horaria del dispositivo.
  const fechaNormalizada = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(fecha)
    ? fecha
    : `${fecha}Z`;

  const fechaUtc = new Date(fechaNormalizada);

  if (Number.isNaN(fechaUtc.getTime())) return "Sin fecha";

  const fechaArgentina = new Date(
    fechaUtc.getTime() - 3 * 60 * 60 * 1000
  );

  const dia = String(fechaArgentina.getUTCDate()).padStart(2, "0");
  const mes = String(fechaArgentina.getUTCMonth() + 1).padStart(2, "0");
  const anio = fechaArgentina.getUTCFullYear();
  const hora = String(fechaArgentina.getUTCHours()).padStart(2, "0");
  const minutos = String(fechaArgentina.getUTCMinutes()).padStart(2, "0");

  return `${dia}/${mes}/${anio}, ${hora}:${minutos}`;
};

const obtenerFechaArgentinaISO = () => {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA_ARGENTINA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const anio = partes.find((parte) => parte.type === "year")?.value;
  const mes = partes.find((parte) => parte.type === "month")?.value;
  const dia = partes.find((parte) => parte.type === "day")?.value;

  if (!anio || !mes || !dia) {
    return new Date().toISOString().slice(0, 10);
  }

  return `${anio}-${mes}-${dia}`;
};

const obtenerDiaSemana = (fecha: string) => {
  const [anio, mes, dia] = fecha.split("-").map(Number);

  if (!anio || !mes || !dia) return -1;

  return new Date(anio, mes - 1, dia, 12, 0, 0).getDay();
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function App() {
  // LOGIN
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [activandoNotificaciones, setActivandoNotificaciones] = useState(false);
  const [mensajeNotificaciones, setMensajeNotificaciones] = useState("");
  const [estadoNotificaciones, setEstadoNotificaciones] =
    useState<EstadoNotificaciones>("comprobando");
  const [modoRegistro, setModoRegistro] = useState(false);
  const [nombreRegistro, setNombreRegistro] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [eventoInstalacion, setEventoInstalacion] = useState<BeforeInstallPromptEvent | null>(null);
  const [appInstalada, setAppInstalada] = useState(false);

  // NAVEGACIÓN
  const [seccion, setSeccion] = useState<Seccion>("dashboard");

  // USUARIOS
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  // SEMANAS
  const [semanas, setSemanas] = useState<Semana[]>([]);
  const [cargandoSemanas, setCargandoSemanas] = useState(false);
  const [procesandoCierreSemana, setProcesandoCierreSemana] = useState<string | null>(null);
  const [mostrarNuevaSemana, setMostrarNuevaSemana] = useState(false);
  const [nombreSemana, setNombreSemana] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [pozoSemana, setPozoSemana] = useState("");

  // JUGADAS
  const [jugadas, setJugadas] = useState<Jugada[]>([]);
  const [cargandoJugadas, setCargandoJugadas] = useState(false);
  const [mostrarNuevaJugada, setMostrarNuevaJugada] = useState(false);
  const [usuarioJugada, setUsuarioJugada] = useState("");
  const [semanaJugada, setSemanaJugada] = useState("");
  const [numeros, setNumeros] = useState<string[]>(numerosVacios());
  const [mensajeJugada, setMensajeJugada] = useState("");
  const [guardandoJugada, setGuardandoJugada] = useState(false);
  const [jugadaEditando, setJugadaEditando] = useState<Jugada | null>(null);

  // NÚMEROS SALIDOS
  const [numerosSalidos, setNumerosSalidos] = useState<NumeroSalido[]>([]);
  const [semanaNumeros, setSemanaNumeros] = useState("");
  const [nuevoNumeroSalido, setNuevoNumeroSalido] = useState("");
  const [fechaNumeroSalido, setFechaNumeroSalido] = useState(
    obtenerFechaArgentinaISO()
  );
  const [cargandoNumeros, setCargandoNumeros] = useState(false);
  const [guardandoNumero, setGuardandoNumero] = useState(false);
  const [mensajeNumero, setMensajeNumero] = useState("");

  // COMPROBANTES
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [semanaComprobante, setSemanaComprobante] = useState("");
  const [archivoComprobante, setArchivoComprobante] =
    useState<File | null>(null);
  const [reinicioArchivoComprobante, setReinicioArchivoComprobante] =
    useState(0);
  const [cargandoComprobantes, setCargandoComprobantes] =
    useState(false);
  const [subiendoComprobante, setSubiendoComprobante] =
    useState(false);
  const [mensajeComprobante, setMensajeComprobante] = useState("");
  const [mensajeExitoComprobante, setMensajeExitoComprobante] = useState("");
  const [observacionesComprobantes, setObservacionesComprobantes] =
    useState<Record<string, string>>({});
  const [autorizacionesJuego, setAutorizacionesJuego] =
    useState<AutorizacionJuego[]>([]);
  const [busquedaComprobante, setBusquedaComprobante] = useState("");
  const [busquedaComprobanteAplicada, setBusquedaComprobanteAplicada] =
    useState("");
  const [semanaHabilitacion, setSemanaHabilitacion] = useState("");
  const [mostrarHabilitacionManual, setMostrarHabilitacionManual] =
    useState(false);
  const [paginaPendientes, setPaginaPendientes] = useState(1);
  const [paginaAnteriores, setPaginaAnteriores] = useState(1);
  const [paginaHabilitacion, setPaginaHabilitacion] = useState(1);
  const [semanaExportacion, setSemanaExportacion] = useState("");
  const [estadoExportacion, setEstadoExportacion] = useState(
    "todos"
  );
  const [exportandoComprobantes, setExportandoComprobantes] =
    useState(false);

  const esAdmin = usuario?.rol === "admin";

  const semanaAbierta = useMemo(
    () => semanas.find((item) => item.estado === "abierta"),
    [semanas]
  );

  const cargarPerfilPorCorreo = async (correo: string) => {
    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, nombre, email, rol, habilitado, aprobado, max_jugadas_semana"
      )
      .ilike("email", correo.trim().toLowerCase())
      .limit(1)
      .maybeSingle();

    if (error || !data || !data.aprobado || !data.habilitado) {
      setUsuario(null);
      return null;
    }

    const perfil = data as Usuario;
    setUsuario(perfil);
    return perfil;
  };

  useEffect(() => {
    const estaInstalada =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    setAppInstalada(estaInstalada);

    const guardarEvento = (evento: Event) => {
      evento.preventDefault();
      setEventoInstalacion(evento as BeforeInstallPromptEvent);
    };

    const confirmarInstalacion = () => {
      setAppInstalada(true);
      setEventoInstalacion(null);
    };

    window.addEventListener("beforeinstallprompt", guardarEvento);
    window.addEventListener("appinstalled", confirmarInstalacion);

    return () => {
      window.removeEventListener("beforeinstallprompt", guardarEvento);
      window.removeEventListener("appinstalled", confirmarInstalacion);
    };
  }, []);

  const instalarAplicacion = async () => {
    if (eventoInstalacion) {
      await eventoInstalacion.prompt();
      const eleccion = await eventoInstalacion.userChoice;

      if (eleccion.outcome === "accepted") {
        setAppInstalada(true);
      }

      setEventoInstalacion(null);
      return;
    }

    alert(
      "Para instalar La Polla, abrí el menú de Chrome (⋮) y elegí ‘Instalar aplicación’ o ‘Agregar a pantalla principal’."
    );
  };

  useEffect(() => {
    let activo = true;

    const restaurarSesion = async () => {
      const { data } = await supabase.auth.getSession();
      const correo = data.session?.user?.email;

      if (activo && correo) {
        const perfil = await cargarPerfilPorCorreo(correo);
        if (!perfil) await supabase.auth.signOut();
      }

      if (activo) setCargandoSesion(false);
    };

    restaurarSesion();

    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      async (_evento, sesion) => {
        if (!activo) return;

        const correo = sesion?.user?.email;
        if (!correo) {
          setUsuario(null);
          setCargandoSesion(false);
          return;
        }

        await cargarPerfilPorCorreo(correo);
        setCargandoSesion(false);
      }
    );

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    const comprobarNotificaciones = async () => {
      if (!usuario) {
        setEstadoNotificaciones("comprobando");
        setMensajeNotificaciones("");
        return;
      }

      setEstadoNotificaciones("comprobando");
      const resultado = await comprobarEstadoNotificaciones(usuario.id);

      if (!vigente) return;
      setEstadoNotificaciones(resultado.estado);
      setMensajeNotificaciones(resultado.mensaje);
    };

    comprobarNotificaciones();

    return () => {
      vigente = false;
    };
  }, [usuario]);

  const activarNotificaciones = async () => {
    if (!usuario) return;

    setActivandoNotificaciones(true);
    setMensajeNotificaciones("Activando notificaciones...");

    const resultado = await activarNotificacionesPush(usuario.id);

    setMensajeNotificaciones(resultado.mensaje);
    setEstadoNotificaciones(resultado.exito ? "activadas" : "desactivadas");
    setActivandoNotificaciones(false);
  };

  const login = async () => {
    if (!email.trim() || !password) {
      setMensaje("Completá el correo y la contraseña");
      return;
    }

    setCargando(true);
    setMensaje("Ingresando...");

    const correo = email.trim().toLowerCase();

    const { error: errorLogin } =
      await supabase.auth.signInWithPassword({
        email: correo,
        password,
      });

    if (errorLogin) {
      setMensaje("Correo o contraseña incorrectos");
      setCargando(false);
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, nombre, email, rol, habilitado, aprobado, max_jugadas_semana"
      )
      .ilike("email", correo)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      setMensaje("El usuario no está registrado en el sistema");
      setCargando(false);
      return;
    }

    if (!data.aprobado) {
      await supabase.auth.signOut();
      setMensaje(
        "Tu cuenta todavía está pendiente de aprobación del administrador."
      );
      setCargando(false);
      return;
    }

    if (!data.habilitado) {
      await supabase.auth.signOut();
      setMensaje("Usuario deshabilitado. Consulte al administrador.");
      setCargando(false);
      return;
    }

    setUsuario(data as Usuario);
    setMensaje("");
    setCargando(false);
  };

  const registrarse = async () => {
    if (!nombreRegistro.trim() || !email.trim() || !password) {
      setMensaje("Completá nombre, correo y contraseña");
      return;
    }

    if (password.length < 6) {
      setMensaje("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmarPassword) {
      setMensaje("Las contraseñas no coinciden");
      return;
    }

    setCargando(true);
    setMensaje("Creando cuenta...");

    const correo = email.trim().toLowerCase();

    const { error } = await supabase.auth.signUp({
      email: correo,
      password,
      options: {
        data: {
          nombre: nombreRegistro.trim(),
        },
      },
    });

    if (error) {
      setMensaje("No se pudo crear la cuenta: " + error.message);
      setCargando(false);
      return;
    }

    await supabase.auth.signOut();

    setNombreRegistro("");
    setPassword("");
    setConfirmarPassword("");
    setModoRegistro(false);
    setMensaje(
      "Cuenta creada. Ahora debe ser aprobada por el administrador."
    );
    setCargando(false);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();

    setUsuario(null);
    setEmail("");
    setPassword("");
    setMensaje("");
    setSeccion("dashboard");
    setUsuarios([]);
    setSemanas([]);
    setJugadas([]);
    setNumerosSalidos([]);
    setComprobantes([]);
    setAutorizacionesJuego([]);
  };

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);

    const { data, error } = await supabase
      .from("usuarios")
      .select(
        "id, nombre, email, rol, habilitado, aprobado, max_jugadas_semana"
      )
      .order("nombre", { ascending: true });

    if (error) {
      alert("No se pudieron cargar los usuarios: " + error.message);
      setCargandoUsuarios(false);
      return;
    }

    setUsuarios((data ?? []) as Usuario[]);
    setCargandoUsuarios(false);
  };

  const cambiarEstadoUsuario = async (item: Usuario) => {
    if (item.email.toLowerCase() === usuario?.email.toLowerCase()) {
      alert("No podés deshabilitar tu propio usuario.");
      return;
    }

    const nuevoEstado = !item.habilitado;

    const { error } = await supabase
      .from("usuarios")
      .update({ habilitado: nuevoEstado })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo actualizar el usuario: " + error.message);
      return;
    }

    await cargarUsuarios();
  };

  const aprobarUsuario = async (item: Usuario) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ aprobado: true, habilitado: true })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo aprobar el usuario: " + error.message);
      return;
    }

    await cargarUsuarios();
  };

  const cambiarMaxJugadas = async (
    item: Usuario,
    cantidad: number
  ) => {
    const { error } = await supabase
      .from("usuarios")
      .update({ max_jugadas_semana: cantidad })
      .eq("id", item.id);

    if (error) {
      alert("No se pudo modificar el límite: " + error.message);
      return;
    }

    await cargarUsuarios();
  };

  const eliminarUsuario = async (item: Usuario) => {
    if (!usuario || !esAdmin) return;

    if (item.id === usuario.id) {
      alert("No podés eliminar tu propio usuario administrador.");
      return;
    }

    const confirmar = window.confirm(
      `¿Eliminar definitivamente a ${item.nombre}?\n\n` +
        "Se eliminarán su acceso, jugadas y comprobantes. " +
        "Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    const { data: archivos } = await supabase
      .from("comprobantes")
      .select("archivo_url")
      .eq("usuario_id", item.id);

    const rutas = (archivos ?? [])
      .map((archivo) => archivo.archivo_url)
      .filter(Boolean);

    if (rutas.length > 0) {
      const { error: errorArchivos } = await supabase.storage
        .from("Comprobantes")
        .remove(rutas);

      if (errorArchivos) {
        alert(
          "No se pudieron borrar los archivos del usuario: " +
            errorArchivos.message
        );
        return;
      }
    }

    const { error } = await supabase.rpc(
      "eliminar_usuario_completo",
      { p_usuario_id: item.id }
    );

    if (error) {
      alert("No se pudo eliminar el usuario: " + error.message);
      return;
    }

    alert("Usuario eliminado definitivamente.");
    await cargarUsuarios();
    await cargarJugadas();
    await cargarComprobantes();
  };

  const cargarSemanas = async () => {
    setCargandoSemanas(true);

    const { data, error } = await supabase
      .from("semanas")
      .select("id, nombre, fecha_inicio, fecha_fin, estado, pozo, resultado, semana_origen_id, pozo_arrastrado")
      .order("fecha_inicio", { ascending: false });

    if (error) {
      alert("No se pudieron cargar las semanas: " + error.message);
      setCargandoSemanas(false);
      return;
    }

    const lista = (data ?? []) as Semana[];
    setSemanas(lista);

    const masReciente = [...lista].sort((a, b) =>
      b.fecha_inicio.localeCompare(a.fecha_inicio)
    )[0];
    if (masReciente) {
      setSemanaHabilitacion((actual) => actual || masReciente.id);
    }

    const abierta = lista.find((item) => item.estado === "abierta");
    const semanaResultados = abierta ?? lista[0];

    setSemanaNumeros((actual) => {
      const sigueExistiendo = lista.some((item) => item.id === actual);
      return sigueExistiendo ? actual : (semanaResultados?.id ?? "");
    });

    setSemanaJugada((actual) => {
      if (!abierta) return "";
      return actual === abierta.id ? actual : abierta.id;
    });

    setCargandoSemanas(false);
  };

  const crearSemana = async () => {
    if (!nombreSemana.trim() || !fechaInicio || !fechaFin) {
      alert("Completá todos los campos");
      return;
    }

    if (fechaFin < fechaInicio) {
      alert("La fecha final no puede ser anterior a la fecha inicial");
      return;
    }

    const { error: errorCerrar } = await supabase
      .from("semanas")
      .update({ estado: "cerrada" })
      .eq("estado", "abierta");

    if (errorCerrar) {
      alert("No se pudo cerrar la semana anterior");
      return;
    }

    const { error } = await supabase.from("semanas").insert({
      nombre: nombreSemana.trim(),
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: "abierta",
      resultado: "en_curso",
      pozo: Number(pozoSemana) || 0,
    });

    if (error) {
      alert("No se pudo crear la semana: " + error.message);
      return;
    }

    setNombreSemana("");
    setFechaInicio("");
    setFechaFin("");
    setPozoSemana("");
    setMostrarNuevaSemana(false);

    await cargarSemanas();
  };

  const modificarPozoSemana = async (semana: Semana) => {
    const valorActual = String(semana.pozo ?? 0);

    const nuevoValor = window.prompt(
      `Ingresá el pozo acumulado para ${semana.nombre}`,
      valorActual
    );

    if (nuevoValor === null) return;

    const limpio = nuevoValor.replace(/[^0-9.,]/g, "").replace(",", ".");
    const monto = Number(limpio);

    if (Number.isNaN(monto) || monto < 0) {
      alert("Ingresá un monto válido");
      return;
    }

    const { error } = await supabase
      .from("semanas")
      .update({ pozo: monto })
      .eq("id", semana.id);

    if (error) {
      alert("No se pudo actualizar el pozo: " + error.message);
      return;
    }

    await cargarSemanas();
  };

  const cambiarEstadoSemana = async (semana: Semana) => {
    const nuevoEstado =
      semana.estado === "abierta" ? "cerrada" : "abierta";

    const confirmar =
      nuevoEstado === "cerrada"
        ? "¿Cerrar esta semana? Ya no se podrán cargar jugadas."
        : "¿Abrir esta semana? Las demás semanas abiertas se cerrarán.";

    if (!window.confirm(confirmar)) return;

    if (nuevoEstado === "abierta") {
      const { error: errorCerrar } = await supabase
        .from("semanas")
        .update({ estado: "cerrada" })
        .eq("estado", "abierta");

      if (errorCerrar) {
        alert("No se pudieron cerrar las otras semanas");
        return;
      }
    }

    const { error } = await supabase
      .from("semanas")
      .update({ estado: nuevoEstado })
      .eq("id", semana.id);

    if (error) {
      alert("No se pudo cambiar el estado: " + error.message);
      return;
    }

    await cargarSemanas();
  };

  const cerrarYEvaluarSemana = async (semana: Semana) => {
    if (!esAdmin || semana.resultado !== "en_curso") return;

    const jugadasSemana = jugadas.filter(
      (jugada) => jugada.semana_id === semana.id
    );
    const ganadoras = jugadasSemana.filter(jugadaEsGanadora);

    if (ganadoras.length > 0) {
      const nombres = ganadoras
        .map(
          (jugada) =>
            `${nombreUsuario(jugada.usuario_id)} (Jugada #${jugada.numero_jugada})`
        )
        .join("\n");

      const confirmar = window.confirm(
        `Se encontraron ${ganadoras.length} jugada(s) ganadora(s):\n\n${nombres}\n\n¿Finalizar la semana con ganador?`
      );
      if (!confirmar) return;

      setProcesandoCierreSemana(semana.id);
      const { error } = await supabase
        .from("semanas")
        .update({ estado: "cerrada", resultado: "finalizada" })
        .eq("id", semana.id);
      setProcesandoCierreSemana(null);

      if (error) {
        alert("No se pudo finalizar la semana: " + error.message);
        return;
      }

      alert("Semana finalizada correctamente. Hubo ganador.");
      await cargarSemanas();
      return;
    }

    const confirmarVacante = window.confirm(
      `Nadie alcanzó los 10 aciertos en ${semana.nombre}.\n\n` +
        `Se declarará el pozo vacante, se creará la semana siguiente y se copiarán ${jugadasSemana.length} jugada(s) con los mismos números bloqueados.\n\n` +
        `El pozo de ${new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(semana.pozo ?? 0)} se arrastrará automáticamente.\n\n¿Continuar?`
    );
    if (!confirmarVacante) return;

    setProcesandoCierreSemana(semana.id);
    const { data, error } = await supabase.rpc(
      "declarar_pozo_vacante",
      { p_semana_id: semana.id }
    );
    setProcesandoCierreSemana(null);

    if (error) {
      alert(
        "No se pudo declarar el pozo vacante. Ejecutá primero el SQL incluido en el ZIP. Detalle: " +
          error.message
      );
      return;
    }

    alert(
      `Pozo vacante declarado. Se creó la nueva semana y se copiaron ${jugadasSemana.length} jugada(s) bloqueadas.`
    );
    setSemanaNumeros(typeof data === "string" ? data : "");
    await Promise.all([
      cargarSemanas(),
      cargarJugadas(),
      cargarTodosLosNumerosSalidos(),
      cargarComprobantes(),
      cargarAutorizacionesJuego(),
    ]);
  };

  const eliminarSemana = async (semana: Semana) => {
    if (!esAdmin) return;

    const confirmar = window.confirm(
      `¿Eliminar definitivamente ${semana.nombre}?\n\n` +
        "También se eliminarán sus jugadas, números salidos y comprobantes. " +
        "Esta acción no se puede deshacer."
    );

    if (!confirmar) return;

    const { data: archivos } = await supabase
      .from("comprobantes")
      .select("archivo_url")
      .eq("semana_id", semana.id);

    const rutas = (archivos ?? [])
      .map((archivo) => archivo.archivo_url)
      .filter(Boolean);

    if (rutas.length > 0) {
      const { error: errorArchivos } = await supabase.storage
        .from("Comprobantes")
        .remove(rutas);

      if (errorArchivos) {
        alert(
          "No se pudieron borrar los comprobantes de la semana: " +
            errorArchivos.message
        );
        return;
      }
    }

    const { error } = await supabase.rpc(
      "eliminar_semana_completa",
      { p_semana_id: semana.id }
    );

    if (error) {
      alert("No se pudo eliminar la semana: " + error.message);
      return;
    }

    if (semanaNumeros === semana.id) setSemanaNumeros("");
    if (semanaJugada === semana.id) setSemanaJugada("");
    if (semanaComprobante === semana.id) setSemanaComprobante("");

    alert("Semana eliminada definitivamente.");
    await cargarSemanas();
    await cargarJugadas();
    await cargarTodosLosNumerosSalidos();
    await cargarComprobantes();
  };

  const cargarJugadas = async () => {
    if (!usuario) return;

    setCargandoJugadas(true);
    setMensajeJugada("");

    let consulta = supabase
      .from("jugadas")
      .select("*")
      .order("created_at", { ascending: false });

    if (!esAdmin) {
      consulta = consulta.eq("usuario_id", usuario.id);
    }

    const { data, error } = await consulta;

    if (error) {
      setMensajeJugada(
        "No se pudieron cargar las jugadas: " + error.message
      );
      setCargandoJugadas(false);
      return;
    }

    setJugadas((data ?? []) as Jugada[]);
    setCargandoJugadas(false);
  };

  const cambiarNumero = (posicion: number, valor: string) => {
    const limpio = valor.replace(/\D/g, "").slice(0, 2);

    setNumeros((anteriores) =>
      anteriores.map((numero, indice) =>
        indice === posicion ? limpio : numero
      )
    );
  };

  const guardarJugada = async () => {
    if (!usuario) return;

    setMensajeJugada("");

    const idUsuario = esAdmin ? usuarioJugada : usuario.id;

    if (!idUsuario) {
      setMensajeJugada("Seleccioná un usuario");
      return;
    }

    if (!semanaJugada) {
      setMensajeJugada("Seleccioná una semana");
      return;
    }

    const semanaSeleccionada = semanas.find(
      (item) => item.id === semanaJugada
    );

    if (!semanaSeleccionada) {
      setMensajeJugada("La semana seleccionada no existe");
      return;
    }

    if (semanaSeleccionada.estado !== "abierta") {
      setMensajeJugada(
        "La semana está cerrada. Solo podés consultar los aciertos."
      );
      return;
    }

    if (!pagoAprobado(idUsuario, semanaJugada)) {
      setMensajeJugada(
        "El comprobante de esta semana todavía no está aprobado. No se puede cargar la jugada."
      );
      return;
    }

    if (numeros.some((numero) => numero === "")) {
      setMensajeJugada("Completá los 10 números");
      return;
    }

    const numerosNormalizados = numeros.map((numero) =>
      numero.padStart(2, "0")
    );

    const fueraDeRango = numerosNormalizados.some((numero) => {
      const valor = Number(numero);
      return valor < 0 || valor > 99;
    });

    if (fueraDeRango) {
      setMensajeJugada("Los números deben estar entre 00 y 99");
      return;
    }

    setGuardandoJugada(true);

    if (jugadaEditando) {
      const puedeEditar =
        esAdmin || jugadaEditando.usuario_id === usuario.id;

      if (!puedeEditar) {
        setMensajeJugada("No podés modificar esta jugada");
        setGuardandoJugada(false);
        return;
      }

      const { error } = await supabase
        .from("jugadas")
        .update({
          n1: numerosNormalizados[0],
          n2: numerosNormalizados[1],
          n3: numerosNormalizados[2],
          n4: numerosNormalizados[3],
          n5: numerosNormalizados[4],
          n6: numerosNormalizados[5],
          n7: numerosNormalizados[6],
          n8: numerosNormalizados[7],
          n9: numerosNormalizados[8],
          n10: numerosNormalizados[9],
        })
        .eq("id", jugadaEditando.id);

      if (error) {
        setMensajeJugada("No se pudo modificar: " + error.message);
        setGuardandoJugada(false);
        return;
      }

      setMensajeJugada("Jugada modificada correctamente");
    } else {
      const usuarioSeleccionado =
        usuarios.find((item) => item.id === idUsuario) ??
        (usuario.id === idUsuario ? usuario : null);

      const limite = usuarioSeleccionado?.max_jugadas_semana ?? 1;

      const { count, error: errorCantidad } = await supabase
        .from("jugadas")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", idUsuario)
        .eq("semana_id", semanaJugada);

      if (errorCantidad) {
        setMensajeJugada("No se pudo verificar el límite de jugadas");
        setGuardandoJugada(false);
        return;
      }

      if ((count ?? 0) >= limite) {
        setMensajeJugada(
          `Límite alcanzado: ${count ?? 0} de ${limite} jugadas cargadas`
        );
        setGuardandoJugada(false);
        return;
      }

      const numeroJugada = (count ?? 0) + 1;

      const { error } = await supabase.from("jugadas").insert({
        usuario_id: idUsuario,
        semana_id: semanaJugada,
        numero_jugada: numeroJugada,
        n1: numerosNormalizados[0],
        n2: numerosNormalizados[1],
        n3: numerosNormalizados[2],
        n4: numerosNormalizados[3],
        n5: numerosNormalizados[4],
        n6: numerosNormalizados[5],
        n7: numerosNormalizados[6],
        n8: numerosNormalizados[7],
        n9: numerosNormalizados[8],
        n10: numerosNormalizados[9],
        bloqueada: false,
      });

      if (error) {
        setMensajeJugada("No se pudo guardar: " + error.message);
        setGuardandoJugada(false);
        return;
      }

      setMensajeJugada("Jugada guardada correctamente");
    }

    setNumeros(numerosVacios());
    setMostrarNuevaJugada(false);
    setJugadaEditando(null);
    setGuardandoJugada(false);

    await cargarJugadas();
  };

  const guardarJugadaDirecta = async (numerosDirectos: string[]) => {
    if (!usuario || !semanaAbierta) return false;

    setMensajeJugada("");

    if (semanaAbierta.estado !== "abierta") {
      setMensajeJugada("La semana está cerrada.");
      return false;
    }

    if (!pagoAprobado(usuario.id, semanaAbierta.id)) {
      setMensajeJugada(
        "El comprobante de esta semana todavía no está aprobado."
      );
      return false;
    }

    if (numerosDirectos.some((numero) => numero === "")) {
      setMensajeJugada("Completá los 10 números de la jugada");
      return false;
    }

    const normalizados = numerosDirectos.map((numero) =>
      numero.padStart(2, "0")
    );

    if (
      normalizados.some((numero) => {
        const valor = Number(numero);
        return Number.isNaN(valor) || valor < 0 || valor > 99;
      })
    ) {
      setMensajeJugada("Los números deben estar entre 00 y 99");
      return false;
    }

    const { count, error: errorCantidad } = await supabase
      .from("jugadas")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuario.id)
      .eq("semana_id", semanaAbierta.id);

    if (errorCantidad) {
      setMensajeJugada("No se pudo verificar la cantidad de jugadas");
      return false;
    }

    if ((count ?? 0) >= usuario.max_jugadas_semana) {
      setMensajeJugada(
        `Límite alcanzado: ${count ?? 0} de ${usuario.max_jugadas_semana}`
      );
      return false;
    }

    const numeroJugada = (count ?? 0) + 1;
    const { error } = await supabase.from("jugadas").insert({
      usuario_id: usuario.id,
      semana_id: semanaAbierta.id,
      numero_jugada: numeroJugada,
      n1: normalizados[0],
      n2: normalizados[1],
      n3: normalizados[2],
      n4: normalizados[3],
      n5: normalizados[4],
      n6: normalizados[5],
      n7: normalizados[6],
      n8: normalizados[7],
      n9: normalizados[8],
      n10: normalizados[9],
      bloqueada: false,
    });

    if (error) {
      setMensajeJugada("No se pudo guardar la jugada: " + error.message);
      return false;
    }

    setMensajeJugada(`Jugada #${numeroJugada} guardada correctamente`);
    await cargarJugadas();
    return true;
  };

  const editarJugada = (jugada: Jugada) => {
    const semana = semanas.find(
      (item) => item.id === jugada.semana_id
    );

    if (!semana || semana.estado !== "abierta") {
      setMensajeJugada(
        "La semana está cerrada. Esta jugada ya no puede modificarse."
      );
      return;
    }

    if (!esAdmin && jugada.usuario_id !== usuario?.id) {
      setMensajeJugada("No podés modificar esta jugada");
      return;
    }

    setJugadaEditando(jugada);
    setUsuarioJugada(jugada.usuario_id);
    setSemanaJugada(jugada.semana_id);
    setNumeros(obtenerNumerosJugada(jugada));
    setMostrarNuevaJugada(true);
    setMensajeJugada("");
  };

  const eliminarJugada = async (jugada: Jugada) => {
    if (!usuario) return;

    const semana = semanas.find(
      (item) => item.id === jugada.semana_id
    );

    if (!semana || semana.estado !== "abierta") {
      setMensajeJugada(
        "La semana está cerrada. La jugada no puede eliminarse."
      );
      return;
    }

    const puedeEliminar =
      esAdmin || jugada.usuario_id === usuario.id;

    if (!puedeEliminar) {
      setMensajeJugada("No podés eliminar esta jugada");
      return;
    }

    if (!window.confirm("¿Eliminar esta jugada?")) return;

    const { error } = await supabase
      .from("jugadas")
      .delete()
      .eq("id", jugada.id);

    if (error) {
      setMensajeJugada("No se pudo eliminar: " + error.message);
      return;
    }

    await cargarJugadas();
  };

  const obtenerNumerosJugada = (jugada: Jugada) => [
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

  const cargarTodosLosNumerosSalidos = async () => {
    const { data, error } = await supabase
      .from("numeros_salidos")
      .select("id, semana_id, numero, fecha, created_at")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error(
        "No se pudieron cargar todos los números salidos:",
        error.message
      );
      return;
    }

    setNumerosSalidos((data ?? []) as NumeroSalido[]);
  };

  const cargarNumerosSalidos = async (semanaId?: string) => {
    const id = semanaId ?? semanaNumeros;

    if (!id) {
      setNumerosSalidos([]);
      return;
    }

    setCargandoNumeros(true);
    setMensajeNumero("");

    const { data, error } = await supabase
      .from("numeros_salidos")
      .select("id, semana_id, numero, fecha, created_at")
      .eq("semana_id", id)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMensajeNumero(
        "No se pudieron cargar los números salidos: " + error.message
      );
      setCargandoNumeros(false);
      return;
    }

    const resultadosSemana = (data ?? []) as NumeroSalido[];

    setNumerosSalidos((actuales) => [
      ...actuales.filter((item) => item.semana_id !== id),
      ...resultadosSemana,
    ]);

    setCargandoNumeros(false);
  };

  const verificarYNotificarGanador = async (semanaId: string) => {
    try {
      const claveNotificacion = `ganador_notificado_${semanaId}`;

      // Evita repetir el aviso desde este administrador/navegador.
      if (localStorage.getItem(claveNotificacion) === "si") return;

      const [
        { data: jugadasSemana, error: errorJugadas },
        { data: resultadosSemana, error: errorResultados },
        { data: semanaDatos, error: errorSemana },
        { data: usuariosDatos, error: errorUsuarios },
      ] = await Promise.all([
        supabase
          .from("jugadas")
          .select("*")
          .eq("semana_id", semanaId),
        supabase
          .from("numeros_salidos")
          .select("numero")
          .eq("semana_id", semanaId),
        supabase
          .from("semanas")
          .select("id, nombre")
          .eq("id", semanaId)
          .maybeSingle(),
        supabase
          .from("usuarios")
          .select("id, nombre"),
      ]);

      if (errorJugadas || errorResultados || errorSemana || errorUsuarios) {
        console.error("No se pudo comprobar si hay ganador:", {
          errorJugadas,
          errorResultados,
          errorSemana,
          errorUsuarios,
        });
        return;
      }

      const cantidadesDisponibles: Record<string, number> = {};

      (resultadosSemana ?? []).forEach((item) => {
        const numero = String(item.numero).padStart(2, "0");
        cantidadesDisponibles[numero] =
          (cantidadesDisponibles[numero] ?? 0) + 1;
      });

      const calcularAciertos = (jugada: Jugada) => {
        const cantidadesUsadas: Record<string, number> = {};
        const numerosJugada = [
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

        return numerosJugada.reduce((total, numeroOriginal) => {
          const numero = String(numeroOriginal).padStart(2, "0");
          const usados = cantidadesUsadas[numero] ?? 0;
          const disponibles = cantidadesDisponibles[numero] ?? 0;

          if (usados < disponibles) {
            cantidadesUsadas[numero] = usados + 1;
            return total + 1;
          }

          return total;
        }, 0);
      };

      const ganadoras = ((jugadasSemana ?? []) as Jugada[]).filter(
        (jugada) => calcularAciertos(jugada) === 10
      );

      if (ganadoras.length === 0) return;

      const nombresPorId = new Map(
        (usuariosDatos ?? []).map((item) => [item.id, item.nombre])
      );

      const ganadoresUnicos = Array.from(
        new Set(
          ganadoras.map(
            (jugada) =>
              nombresPorId.get(jugada.usuario_id) ?? "Usuario ganador"
          )
        )
      );

      const titulo = "🏆 ¡Tenemos ganador!";
      const mensaje =
        ganadoresUnicos.length === 1
          ? `${ganadoresUnicos[0]} alcanzó los 10 aciertos en ${
              semanaDatos?.nombre ?? "la semana actual"
            }.`
          : `${ganadoresUnicos.join(", ")} alcanzaron los 10 aciertos en ${
              semanaDatos?.nombre ?? "la semana actual"
            }.`;

      const { error: errorNotificacion } = await supabase.functions.invoke(
        "enviar-notificacion",
        {
          body: {
            titulo,
            mensaje,
            url: "/",
          },
        }
      );

      if (errorNotificacion) {
        console.error(
          "Se detectó un ganador, pero no se pudo enviar la notificación:",
          errorNotificacion
        );
        setMensajeNumero(
          "Número agregado y ganador detectado, pero no se pudo enviar el aviso automático."
        );
        return;
      }

      localStorage.setItem(claveNotificacion, "si");
      setMensajeNumero(
        `Número agregado correctamente. 🏆 Se detectó ganador y se envió la notificación automática.`
      );
    } catch (error) {
      console.error("Error verificando ganador:", error);
    }
  };

  const guardarNumeroSalido = async () => {
    if (!semanaNumeros) {
      setMensajeNumero("Seleccioná una semana");
      return;
    }

    if (!fechaNumeroSalido) {
      setMensajeNumero("Seleccioná una fecha");
      return;
    }

    if (!nuevoNumeroSalido.trim()) {
      setMensajeNumero("Ingresá un número");
      return;
    }

    const diaSemana = obtenerDiaSemana(fechaNumeroSalido);

    if (diaSemana < 2 || diaSemana > 6) {
      setMensajeNumero(
        "Los números solo se pueden cargar de martes a sábado"
      );
      return;
    }

    const numero = nuevoNumeroSalido.padStart(2, "0");
    const valor = Number(numero);

    if (Number.isNaN(valor) || valor < 0 || valor > 99) {
      setMensajeNumero("El número debe estar entre 00 y 99");
      return;
    }

    const { count, error: errorConteo } = await supabase
      .from("numeros_salidos")
      .select("id", { count: "exact", head: true })
      .eq("semana_id", semanaNumeros)
      .eq("fecha", fechaNumeroSalido);

    if (errorConteo) {
      setMensajeNumero(
        "No se pudo verificar la cantidad de números del día: " +
          errorConteo.message
      );
      return;
    }

    if ((count ?? 0) >= 20) {
      setMensajeNumero(
        "Ya se cargaron los 20 números permitidos para esta fecha"
      );
      return;
    }

    setGuardandoNumero(true);
    setMensajeNumero("");

    const { error } = await supabase.from("numeros_salidos").insert({
      semana_id: semanaNumeros,
      numero,
      fecha: fechaNumeroSalido,
    });

    if (error) {
      setMensajeNumero("No se pudo guardar el número: " + error.message);
      setGuardandoNumero(false);
      return;
    }

    setNuevoNumeroSalido("");
    setGuardandoNumero(false);
    setMensajeNumero(
      `Número agregado correctamente (${(count ?? 0) + 1}/20 del día)`
    );

    await cargarNumerosSalidos(semanaNumeros);
    await verificarYNotificarGanador(semanaNumeros);
  };

  const eliminarNumeroSalido = async (item: NumeroSalido) => {
    if (!window.confirm(`¿Eliminar el número ${item.numero}?`)) return;

    const { error } = await supabase
      .from("numeros_salidos")
      .delete()
      .eq("id", item.id);

    if (error) {
      setMensajeNumero("No se pudo eliminar: " + error.message);
      return;
    }

    await cargarNumerosSalidos(semanaNumeros);
  };

  const contarSalidasPorNumero = (semanaId: string) => {
    const cantidades: Record<string, number> = {};

    numerosSalidos
      .filter((item) => item.semana_id === semanaId)
      .forEach((item) => {
        const numero = item.numero.padStart(2, "0");
        cantidades[numero] = (cantidades[numero] ?? 0) + 1;
      });

    return cantidades;
  };

  const obtenerEstadoCasilleros = (jugada: Jugada) => {
    const cantidadesDisponibles = contarSalidasPorNumero(
      jugada.semana_id
    );

    const cantidadesUsadas: Record<string, number> = {};

    return obtenerNumerosJugada(jugada).map((numero) => {
      const normalizado = numero.padStart(2, "0");
      const usados = cantidadesUsadas[normalizado] ?? 0;
      const disponibles = cantidadesDisponibles[normalizado] ?? 0;
      const acertado = usados < disponibles;

      if (acertado) {
        cantidadesUsadas[normalizado] = usados + 1;
      }

      return {
        numero: normalizado,
        acertado,
      };
    });
  };

  const calcularAciertosJugada = (jugada: Jugada) =>
    obtenerEstadoCasilleros(jugada).filter(
      (casillero) => casillero.acertado
    ).length;

  const cargarAutorizacionesJuego = async () => {
    if (!usuario) return;

    let consulta = supabase
      .from("autorizaciones_juego")
      .select("id, usuario_id, semana_id, autorizado, motivo, created_at");

    if (!esAdmin) {
      consulta = consulta.eq("usuario_id", usuario.id);
    }

    const { data, error } = await consulta;

    if (error) {
      console.error(
        "No se pudieron cargar las habilitaciones manuales:",
        error.message
      );
      return;
    }

    setAutorizacionesJuego((data ?? []) as AutorizacionJuego[]);
  };

  const cambiarHabilitacionManual = async (
    usuarioId: string,
    semanaId: string,
    habilitar: boolean
  ) => {
    if (!esAdmin || !semanaId) return;

    const { error } = await supabase.rpc(
      "admin_habilitar_juego_sin_comprobante",
      {
        p_usuario_id: usuarioId,
        p_semana_id: semanaId,
        p_habilitar: habilitar,
      }
    );

    if (error) {
      setMensajeComprobante(
        "No se pudo cambiar la habilitación: " + error.message
      );
      return;
    }

    setMensajeComprobante(
      habilitar
        ? "Usuario habilitado para jugar sin comprobante"
        : "Habilitación manual revocada"
    );
    await cargarAutorizacionesJuego();
  };

  const cargarComprobantes = async () => {
    if (!usuario) return;

    setCargandoComprobantes(true);

    let consulta = supabase
      .from("comprobantes")
      .select(
        "id, usuario_id, semana_id, archivo_url, estado, observacion, created_at"
      )
      .order("created_at", { ascending: false });

    if (!esAdmin) {
      consulta = consulta.eq("usuario_id", usuario.id);
    }

    const { data, error } = await consulta;

    if (error) {
      setMensajeComprobante(
        "No se pudieron cargar los comprobantes: " + error.message
      );
      setCargandoComprobantes(false);
      return;
    }

    const lista = (data ?? []) as Comprobante[];
    setComprobantes(lista);

    const borradores: Record<string, string> = {};
    lista.forEach((item) => {
      borradores[item.id] = item.observacion ?? "";
    });
    setObservacionesComprobantes(borradores);
    setCargandoComprobantes(false);
  };

  const subirComprobante = async () => {
    if (!usuario) return;

    setMensajeComprobante("");
    setMensajeExitoComprobante("");

    if (!semanaComprobante) {
      setMensajeComprobante("Seleccioná una semana");
      return;
    }

    const semana = semanas.find(
      (item) => item.id === semanaComprobante
    );

    if (!semana || semana.estado !== "abierta") {
      setMensajeComprobante(
        "La semana está cerrada. No se puede subir ni reemplazar el comprobante."
      );
      return;
    }

    const { data: comprobanteExistente, error: errorConsultaExistente } =
      await supabase
        .from("comprobantes")
        .select("id")
        .eq("usuario_id", usuario.id)
        .eq("semana_id", semanaComprobante)
        .maybeSingle();

    if (errorConsultaExistente) {
      setMensajeComprobante(
        "No se pudo verificar si ya existe un comprobante: " +
          errorConsultaExistente.message
      );
      return;
    }

    if (comprobanteExistente) {
      setMensajeComprobante(
        "Ya tenés un comprobante cargado para esta semana. Solo se permite uno por usuario."
      );
      return;
    }

    if (!archivoComprobante) {
      setMensajeComprobante("Elegí una imagen o un archivo PDF");
      return;
    }

    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "application/pdf",
    ];

    if (!tiposPermitidos.includes(archivoComprobante.type)) {
      setMensajeComprobante(
        "Solo se permiten archivos JPG, PNG o PDF"
      );
      return;
    }

    const limiteBytes = 10 * 1024 * 1024;
    if (archivoComprobante.size > limiteBytes) {
      setMensajeComprobante(
        "El archivo no puede superar los 10 MB"
      );
      return;
    }

    setSubiendoComprobante(true);

    const nombreSeguro = archivoComprobante.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    const ruta =
      `${usuario.id}/${semanaComprobante}/` +
      `${Date.now()}_${nombreSeguro}`;

    const { error: errorSubida } = await supabase.storage
      .from("Comprobantes")
      .upload(ruta, archivoComprobante, {
        cacheControl: "3600",
        upsert: false,
      });

    if (errorSubida) {
      setMensajeComprobante(
        "No se pudo subir el archivo: " + errorSubida.message
      );
      setSubiendoComprobante(false);
      return;
    }

    const resultado = await supabase
      .from("comprobantes")
      .insert({
        usuario_id: usuario.id,
        semana_id: semanaComprobante,
        archivo_url: ruta,
        estado: "pendiente",
        observacion: null,
      });

    const errorBase = resultado.error;

    if (errorBase) {
      await supabase.storage.from("Comprobantes").remove([ruta]);

      setMensajeComprobante(
        "El archivo subió, pero no se pudo registrar: " +
          errorBase.message
      );
      setSubiendoComprobante(false);
      return;
    }

    setArchivoComprobante(null);
    setReinicioArchivoComprobante((valor) => valor + 1);
    setSubiendoComprobante(false);
    await cargarComprobantes();
    setMensajeExitoComprobante(
      "Comprobante subido exitosamente. Hasta que el administrador no lo apruebe, no podés cargar tu jugada."
    );
  };

  const abrirComprobante = async (item: Comprobante) => {
    const { data, error } = await supabase.storage
      .from("Comprobantes")
      .createSignedUrl(item.archivo_url, 600);

    if (error || !data?.signedUrl) {
      setMensajeComprobante(
        "No se pudo abrir el archivo: " +
          (error?.message ?? "enlace no disponible")
      );
      return;
    }

    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const eliminarComprobanteUsuario = async (item: Comprobante) => {
    if (!usuario || esAdmin || item.usuario_id !== usuario.id) return;

    const semana = semanas.find((dato) => dato.id === item.semana_id);

    if (!semana || semana.estado !== "abierta") {
      setMensajeComprobante(
        "La semana está cerrada. No se puede eliminar el comprobante."
      );
      return;
    }

    const confirmar = window.confirm(
      "¿Eliminar este comprobante? Después vas a poder subir uno nuevo."
    );

    if (!confirmar) return;

    setMensajeComprobante("Eliminando comprobante...");

    const { error } = await supabase
      .from("comprobantes")
      .delete()
      .eq("id", item.id)
      .eq("usuario_id", usuario.id);

    if (error) {
      setMensajeComprobante(
        "No se pudo eliminar el comprobante: " + error.message
      );
      return;
    }

    if (item.archivo_url) {
      const { error: errorArchivo } = await supabase.storage
        .from("Comprobantes")
        .remove([item.archivo_url]);

      if (errorArchivo) {
        console.error(
          "El comprobante se eliminó, pero no se pudo borrar el archivo del almacenamiento:",
          errorArchivo.message
        );
      }
    }

    setArchivoComprobante(null);
    setReinicioArchivoComprobante((valor) => valor + 1);
    setMensajeComprobante(
      "Comprobante eliminado. Ya podés subir uno nuevo."
    );
    await cargarComprobantes();
  };

  const revisarComprobante = async (
    item: Comprobante,
    estado: "aprobado" | "rechazado"
  ) => {
    if (!esAdmin) return;

    const observacion =
      observacionesComprobantes[item.id]?.trim() ?? "";

    if (estado === "rechazado" && !observacion) {
      setMensajeComprobante(
        "Escribí una observación para explicar el rechazo"
      );
      return;
    }

    const { error } = await supabase.rpc(
      "revisar_comprobante_admin",
      {
        p_comprobante_id: item.id,
        p_estado: estado,
        p_observacion: observacion || null,
      }
    );

    if (error) {
      setMensajeComprobante(
        "No se pudo actualizar el comprobante: " + error.message
      );
      return;
    }

    setMensajeComprobante(
      estado === "aprobado"
        ? "Comprobante aprobado"
        : "Comprobante rechazado"
    );
    await cargarComprobantes();
  };

  const aprobarTodosLosComprobantes = async () => {
    if (!esAdmin) return;

    const ids = comprobantesPendientes.map((item) => item.id);

    if (ids.length === 0) {
      setMensajeComprobante(
        "No hay comprobantes pendientes para aprobar."
      );
      return;
    }

    const confirmar = window.confirm(
      `¿Aprobar los ${ids.length} comprobantes pendientes mostrados por el filtro actual?`
    );

    if (!confirmar) return;

    setMensajeComprobante(
      `Aprobando ${ids.length} comprobantes...`
    );

    const { error } = await supabase.rpc(
      "aprobar_comprobantes_admin",
      {
        p_comprobante_ids: ids,
      }
    );

    if (error) {
      setMensajeComprobante(
        "No se pudieron aprobar todos: " + error.message
      );
      return;
    }

    setMensajeComprobante(
      `${ids.length} comprobantes aprobados correctamente.`
    );
    setPaginaPendientes(1);
    await cargarComprobantes();
  };

  const limpiarNombreArchivo = (valor: string) =>
    valor
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_");

  const escaparCsv = (valor: unknown) => {
    const texto = String(valor ?? "");
    return `"${texto.replace(/"/g, '""')}"`;
  };

  const descargarBlob = (blob: Blob, nombre: string) => {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
  };

  const exportarComprobantesZip = async () => {
    if (!esAdmin) return;

    if (!semanaExportacion) {
      setMensajeComprobante("Seleccioná una semana para exportar");
      return;
    }

    const semana = semanas.find(
      (item) => item.id === semanaExportacion
    );

    if (!semana) {
      setMensajeComprobante("La semana seleccionada no existe");
      return;
    }

    const comprobantesSemana = comprobantes.filter((item) => {
      if (item.semana_id !== semanaExportacion) return false;
      if (estadoExportacion === "todos") return true;
      return item.estado === estadoExportacion;
    });

    const autorizacionesManuales = autorizacionesJuego.filter(
      (item) =>
        item.semana_id === semanaExportacion && item.autorizado
    );

    if (
      comprobantesSemana.length === 0 &&
      autorizacionesManuales.length === 0
    ) {
      setMensajeComprobante(
        "No hay comprobantes ni habilitaciones manuales para exportar"
      );
      return;
    }

    const confirmar = window.confirm(
      `Se exportarán ${comprobantesSemana.length} comprobantes y ${autorizacionesManuales.length} habilitaciones manuales de ${semana.nombre}. ¿Continuar?`
    );

    if (!confirmar) return;

    setExportandoComprobantes(true);
    setMensajeComprobante("Generando archivo ZIP...");

    try {
      const zip = new JSZip();
      const carpeta = zip.folder("comprobantes");
      const filasResumen: string[][] = [[
        "Nombre",
        "Correo",
        "Semana",
        "Estado comprobante",
        "Tipo de habilitación",
        "Observación",
        "Fecha de envío",
        "Archivo",
      ]];

      let numeroArchivo = 1;

      for (const item of comprobantesSemana) {
        const usuarioItem = usuarios.find(
          (dato) => dato.id === item.usuario_id
        );
        const autorizacionManual = autorizacionesManuales.some(
          (dato) => dato.usuario_id === item.usuario_id
        );

        const nombre = usuarioItem?.nombre ?? "Usuario desconocido";
        const correo = usuarioItem?.email ?? "";
        const extension =
          item.archivo_url.split(".").pop()?.split("?")[0] || "archivo";
        const nombreArchivo = `${String(numeroArchivo).padStart(3, "0")}_${limpiarNombreArchivo(nombre)}_${item.estado}.${extension}`;

        let archivoIncluido = "No se pudo descargar";

        if (item.archivo_url) {
          const { data, error } = await supabase.storage
            .from("Comprobantes")
            .createSignedUrl(item.archivo_url, 900);

          if (!error && data?.signedUrl) {
            const respuesta = await fetch(data.signedUrl);
            if (respuesta.ok) {
              const blob = await respuesta.blob();
              carpeta?.file(nombreArchivo, blob);
              archivoIncluido = nombreArchivo;
              numeroArchivo += 1;
            }
          }
        }

        filasResumen.push([
          nombre,
          correo,
          semana.nombre,
          item.estado,
          item.estado === "aprobado"
            ? "Comprobante aprobado"
            : autorizacionManual
              ? "Habilitación manual"
              : `Comprobante ${item.estado}`,
          item.observacion ?? "",
          item.created_at ? formatearFechaHora(item.created_at) : "",
          archivoIncluido,
        ]);
      }

      const filasManuales: string[][] = [[
        "Nombre",
        "Correo",
        "Semana",
        "Jugadas permitidas",
        "Fecha de habilitación",
        "Motivo",
        "Estado del comprobante",
      ]];

      for (const autorizacion of autorizacionesManuales) {
        const usuarioItem = usuarios.find(
          (dato) => dato.id === autorizacion.usuario_id
        );
        const comprobante = comprobantes.find(
          (dato) =>
            dato.usuario_id === autorizacion.usuario_id &&
            dato.semana_id === semanaExportacion
        );

        const sinComprobanteAprobado =
          !comprobante || comprobante.estado !== "aprobado";

        if (!sinComprobanteAprobado) continue;

        filasManuales.push([
          usuarioItem?.nombre ?? "Usuario desconocido",
          usuarioItem?.email ?? "",
          semana.nombre,
          String(usuarioItem?.max_jugadas_semana ?? 1),
          autorizacion.created_at
            ? formatearFechaHora(autorizacion.created_at)
            : "",
          autorizacion.motivo ?? "Habilitación manual sin comprobante aprobado",
          comprobante?.estado ?? "Sin comprobante",
        ]);

        filasResumen.push([
          usuarioItem?.nombre ?? "Usuario desconocido",
          usuarioItem?.email ?? "",
          semana.nombre,
          comprobante?.estado ?? "Sin comprobante",
          "Habilitación manual sin comprobante aprobado",
          autorizacion.motivo ?? "",
          autorizacion.created_at
            ? formatearFechaHora(autorizacion.created_at)
            : "",
          "Sin archivo — habilitación manual",
        ]);
      }

      const convertirCsv = (filas: string[][]) =>
        "\uFEFF" +
        filas
          .map((fila) => fila.map(escaparCsv).join(";"))
          .join("\r\n");

      zip.file(
        "Resumen_comprobantes.csv",
        convertirCsv(filasResumen)
      );
      zip.file(
        "Habilitados_sin_comprobante.csv",
        convertirCsv(filasManuales)
      );

      const resumenTxt = [
        `Semana: ${semana.nombre}`,
        `Estado: ${semana.estado}`,
        `Total de comprobantes exportados: ${comprobantesSemana.length}`,
        `Pendientes: ${comprobantesSemana.filter((item) => item.estado === "pendiente").length}`,
        `Aprobados: ${comprobantesSemana.filter((item) => item.estado === "aprobado").length}`,
        `Rechazados: ${comprobantesSemana.filter((item) => item.estado === "rechazado").length}`,
        `Habilitados manualmente: ${filasManuales.length - 1}`,
      ].join("\r\n");

      zip.file("RESUMEN.txt", resumenTxt);

      const contenido = await zip.generateAsync({ type: "blob" });
      const nombreZip = `Comprobantes_${limpiarNombreArchivo(semana.nombre)}.zip`;
      descargarBlob(contenido, nombreZip);

      setMensajeComprobante(
        `ZIP generado: ${comprobantesSemana.length} comprobantes y ${filasManuales.length - 1} habilitados manualmente.`
      );
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error desconocido";
      setMensajeComprobante(
        "No se pudo generar el ZIP: " + mensaje
      );
    } finally {
      setExportandoComprobantes(false);
    }
  };

  const nombreUsuario = (id: string) =>
    usuarios.find((item) => item.id === id)?.nombre ??
    "Usuario desconocido";

  const nombreSemanaPorId = (id: string) =>
    semanas.find((item) => item.id === id)?.nombre ??
    "Semana desconocida";

  useEffect(() => {
    if (!usuario) return;

    if (seccion === "dashboard") {
      cargarUsuarios();
      cargarSemanas();
      cargarJugadas();
      cargarComprobantes();
      cargarAutorizacionesJuego();
      cargarTodosLosNumerosSalidos();
    }

    if (seccion === "usuarios" && esAdmin) {
      cargarUsuarios();
    }

    if (seccion === "semanas" && esAdmin) {
      cargarSemanas();
    }

    if (seccion === "jugadas") {
      cargarUsuarios();
      cargarSemanas();
      cargarJugadas();
      cargarComprobantes();
      cargarAutorizacionesJuego();
      cargarTodosLosNumerosSalidos();
    }

    if (seccion === "numeros" && esAdmin) {
      cargarSemanas();
      cargarTodosLosNumerosSalidos();
    }

    if (seccion === "comprobantes") {
      cargarUsuarios();
      cargarSemanas();
      cargarComprobantes();
      cargarAutorizacionesJuego();
    }
  }, [usuario, seccion]);

  useEffect(() => {
    if (usuario) {
      cargarTodosLosNumerosSalidos();
    }
  }, [usuario]);

  useEffect(() => {
    if (semanaNumeros) {
      cargarNumerosSalidos(semanaNumeros);
    }
  }, [semanaNumeros]);


  const obtenerComprobante = (
    usuarioId: string,
    semanaId: string
  ) =>
    comprobantes.find(
      (item) =>
        item.usuario_id === usuarioId &&
        item.semana_id === semanaId
    );

  const habilitacionManualActiva = (
    usuarioId: string,
    semanaId: string
  ) =>
    autorizacionesJuego.some(
      (item) =>
        item.usuario_id === usuarioId &&
        item.semana_id === semanaId &&
        item.autorizado
    );

  const pagoAprobado = (
    usuarioId: string,
    semanaId: string
  ) =>
    obtenerComprobante(usuarioId, semanaId)?.estado === "aprobado" ||
    habilitacionManualActiva(usuarioId, semanaId);

  const tableroCompleto = Array.from({ length: 100 }, (_, indice) =>
    String(indice).padStart(2, "0")
  );

  const semanaTablero =
    semanaAbierta ??
    [...semanas].sort((a, b) =>
      b.fecha_inicio.localeCompare(a.fecha_inicio)
    )[0];

  const estadoPagoUsuarioActual =
    usuario && semanaTablero
      ? obtenerComprobante(usuario.id, semanaTablero.id)
      : undefined;

  const cantidadesSemanaActual = semanaTablero
    ? contarSalidasPorNumero(semanaTablero.id)
    : {};

  const totalResultadosSemanaActual = Object.values(
    cantidadesSemanaActual
  ).reduce((total, cantidad) => total + cantidad, 0);

  const jugadaEsGanadora = (jugada: Jugada) =>
    calcularAciertosJugada(jugada) === 10;

  // El cartel de ganador y la lista del administrador corresponden
  // únicamente a la semana que se está mostrando actualmente.
  // Al comenzar una semana nueva, los ganadores anteriores dejan de
  // aparecer en la pantalla principal, pero sus jugadas permanecen
  // guardadas para el futuro historial.
  const jugadasGanadoras = semanaTablero
    ? jugadas.filter(
        (jugada) =>
          jugada.semana_id === semanaTablero.id &&
          jugadaEsGanadora(jugada)
      )
    : [];

  const usuarioActualEsGanador = jugadasGanadoras.some(
    (jugada) => jugada.usuario_id === usuario?.id
  );

  const textoBusquedaComprobante =
    busquedaComprobanteAplicada.trim().toLowerCase();

  const comprobantesFiltrados = comprobantes.filter((item) => {
    if (!textoBusquedaComprobante) return true;

    const usuarioItem = usuarios.find(
      (dato) => dato.id === item.usuario_id
    );
    const semanaItem = semanas.find(
      (dato) => dato.id === item.semana_id
    );

    return [
      usuarioItem?.nombre,
      usuarioItem?.email,
      semanaItem?.nombre,
      item.estado,
      item.observacion,
    ].some((valor) =>
      (valor ?? "").toLowerCase().includes(textoBusquedaComprobante)
    );
  });

  const usuariosHabilitacionFiltrados = usuarios.filter((item) => {
    if (item.rol === "admin") return false;
    if (!textoBusquedaComprobante) return true;

    return (
      item.nombre.toLowerCase().includes(textoBusquedaComprobante) ||
      item.email.toLowerCase().includes(textoBusquedaComprobante)
    );
  });

  const comprobantesPendientes = comprobantesFiltrados.filter(
    (item) => item.estado === "pendiente"
  );
  const comprobantesAprobados = comprobantesFiltrados.filter(
    (item) => item.estado === "aprobado"
  );
  const comprobantesRechazados = comprobantesFiltrados.filter(
    (item) => item.estado === "rechazado"
  );

  const semanaResumenHabilitacion =
    semanaHabilitacion || semanaAbierta?.id || "";

  const habilitadosManualmente = semanaResumenHabilitacion
    ? autorizacionesJuego.filter(
        (item) =>
          item.semana_id === semanaResumenHabilitacion &&
          item.autorizado
      ).length
    : 0;

  const elementosPorPagina = 15;

  const totalPaginasPendientes = Math.max(
    1,
    Math.ceil(comprobantesPendientes.length / elementosPorPagina)
  );
  const totalPaginasAnteriores = Math.max(
    1,
    Math.ceil(
      (comprobantesAprobados.length + comprobantesRechazados.length) /
        elementosPorPagina
    )
  );
  const totalPaginasHabilitacion = Math.max(
    1,
    Math.ceil(
      usuariosHabilitacionFiltrados.length / elementosPorPagina
    )
  );

  const pendientesPaginados = comprobantesPendientes.slice(
    (paginaPendientes - 1) * elementosPorPagina,
    paginaPendientes * elementosPorPagina
  );

  const comprobantesAnteriores = [
    ...comprobantesAprobados,
    ...comprobantesRechazados,
  ];

  const anterioresPaginados = comprobantesAnteriores.slice(
    (paginaAnteriores - 1) * elementosPorPagina,
    paginaAnteriores * elementosPorPagina
  );

  const usuariosHabilitacionPaginados =
    usuariosHabilitacionFiltrados.slice(
      (paginaHabilitacion - 1) * elementosPorPagina,
      paginaHabilitacion * elementosPorPagina
    );

  const textoRango = (pagina: number, total: number) => {
    if (total === 0) return "0";
    const desde = (pagina - 1) * elementosPorPagina + 1;
    const hasta = Math.min(pagina * elementosPorPagina, total);
    return `${desde}-${hasta}`;
  };

  if (cargandoSesion) {
    return (
      <div className="app">
        <div className="login-card">
          <h1>LA POLLA</h1>
          <p>Recuperando sesión...</p>
        </div>
      </div>
    );
  }

  if (usuario) {
    return (
      <div className="panel">
        <aside className="sidebar">
          <div className="sidebar-marca">
            <div className="sidebar-logo">LP</div>
            <div>
              <h2>LA POLLA</h2>
              <span>Diversión Semanal</span>
            </div>
          </div>

          {semanaTablero && (
            <div className="sidebar-resumen">
              <span>{semanaTablero.nombre}</span>
              <strong>
                {new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  maximumFractionDigits: 0,
                }).format(semanaTablero.pozo ?? 0)}
              </strong>
              <small>Pozo acumulado</small>
            </div>
          )}

          <nav>
            <button className={seccion === "dashboard" ? "activo" : ""} onClick={() => setSeccion("dashboard")}>
              🏠 Dashboard
            </button>

            {esAdmin && (
              <button className={seccion === "usuarios" ? "activo" : ""} onClick={() => setSeccion("usuarios")}>
                👥 Usuarios
              </button>
            )}

            <button className={seccion === "jugadas" ? "activo" : ""} onClick={() => setSeccion("jugadas")}>
              🎲 {esAdmin ? "Jugadas" : "Mis jugadas"}
            </button>

            {esAdmin && (
              <>
                <button className={seccion === "semanas" ? "activo" : ""} onClick={() => setSeccion("semanas")}>
                  📅 Semanas
                </button>

                <button className={seccion === "numeros" ? "activo" : ""} onClick={() => setSeccion("numeros")}>
                  🔢 Números salidos
                </button>

                <button className={seccion === "notificaciones" ? "activo" : ""} onClick={() => setSeccion("notificaciones")}>
                  🔔 Enviar avisos
                </button>
</>
            )}

            <button className={seccion === "comprobantes" ? "activo" : ""} onClick={() => setSeccion("comprobantes")}>
              📎 Comprobantes
            </button>
          </nav>

          <button className="logout" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </aside>

        <main className="contenido">
          {!appInstalada && (
            <div
              className="instalar-pwa-renglon"
              style={{
                width: "100%",
                boxSizing: "border-box",
                marginBottom: "18px",
                padding: "18px 20px",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              <span>📲 INSTALAR LA POLLA EN ESTE DISPOSITIVO</span>
              <button
                type="button"
                onClick={instalarAplicacion}
                style={{
                  minHeight: "48px",
                  padding: "12px 22px",
                  borderRadius: "12px",
                  fontSize: "17px",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Instalar ahora
              </button>
            </div>
          )}

          <header className="encabezado">
            <div>
              <h1>
                {seccion === "dashboard" &&
                  (esAdmin
                    ? "Panel de administración"
                    : "Panel de usuario")}
                {seccion === "usuarios" && "Usuarios"}
                {seccion === "semanas" && "Semanas"}
                {seccion === "jugadas" &&
                  (esAdmin ? "Jugadas" : "Mis jugadas")}
                {seccion === "numeros" && "Números salidos"}
                {seccion === "comprobantes" && "Comprobantes"}
                {seccion === "notificaciones" && "Enviar notificaciones"}
              </h1>

              <p>Bienvenido, {usuario.nombre}</p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className={`boton-activar-notificaciones ${
                  estadoNotificaciones === "activadas" ? "esta-activo" : ""
                }`}
                onClick={activarNotificaciones}
                disabled={
                  activandoNotificaciones ||
                  estadoNotificaciones === "comprobando" ||
                  estadoNotificaciones === "activadas" ||
                  estadoNotificaciones === "bloqueadas" ||
                  estadoNotificaciones === "no_disponibles"
                }
                title={mensajeNotificaciones || "Activar notificaciones en este dispositivo"}
              >
                {activandoNotificaciones
                  ? "Activando..."
                  : estadoNotificaciones === "comprobando"
                    ? "🔔 Comprobando..."
                    : estadoNotificaciones === "activadas"
                      ? "✅ Notificaciones activadas"
                      : estadoNotificaciones === "bloqueadas"
                        ? "🔕 Notificaciones bloqueadas"
                        : estadoNotificaciones === "no_disponibles"
                          ? "🔕 No disponibles"
                          : "🔔 Activar notificaciones"}
              </button>

              <span className="rol">
                {esAdmin ? "Administrador" : "Usuario"}
              </span>

              <button
                type="button"
                onClick={cerrarSesion}
                title="Cerrar sesión"
                style={{
                  minHeight: "44px",
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  border: "1px solid rgba(255,255,255,0.22)",
                  background: "rgba(255,255,255,0.10)",
                  color: "inherit",
                }}
              >
                🚪 Cerrar sesión
              </button>
            </div>
          </header>

          {mensajeNotificaciones && (
            <div
              role="status"
              style={{
                marginBottom: "14px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.08)",
              }}
            >
              {mensajeNotificaciones}
            </div>
          )}

          {semanaTablero && (
            <section className="pozo-destacado">
              <span>🏆 POZO ACUMULADO</span>

              <strong>
                {new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  maximumFractionDigits: 0,
                }).format(semanaTablero.pozo ?? 0)}
              </strong>

              <small>{semanaTablero.nombre}</small>
            </section>
          )}

          {usuarioActualEsGanador && (
            <div className="cartel-ganador">
              <div className="ganador-titulo">¡GANADOR!</div>
              <div className="ganador-subtitulo">
                Acertaste los 10 números de una jugada
              </div>

              <div className="ganador-jugadas">
                {jugadasGanadoras
                  .filter(
                    (jugada) => jugada.usuario_id === usuario.id
                  )
                  .map((jugada) => (
                    <span key={jugada.id}>
                      Jugada #{jugada.numero_jugada} —{" "}
                      {nombreSemanaPorId(jugada.semana_id)}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {seccion === "dashboard" &&
            (esAdmin ? (
              <DashboardAdmin
                cantidadUsuarios={usuarios.length}
                cantidadJugadas={jugadas.length}
                cantidadComprobantes={comprobantes.length}
                semanaActual={semanaTablero}
                jugadasGanadoras={jugadasGanadoras}
                nombreUsuario={nombreUsuario}
                tableroCompleto={tableroCompleto}
                cantidadesSemanaActual={cantidadesSemanaActual}
                totalResultadosSemanaActual={
                  totalResultadosSemanaActual
                }
                onCambiarEstadoSemana={cambiarEstadoSemana}
                onDeclararPozo={cerrarYEvaluarSemana}
                procesandoPozo={procesandoCierreSemana === semanaTablero?.id}
              />
            ) : (
              <DashboardUsuario
                semanaActual={semanaTablero}
                estadoPago={estadoPagoUsuarioActual}
                pagoHabilitado={
                  semanaTablero
                    ? pagoAprobado(usuario.id, semanaTablero.id)
                    : false
                }
                cantidadJugadas={
                  semanaAbierta
                    ? jugadas.filter(
                        (jugada) =>
                          jugada.usuario_id === usuario.id &&
                          jugada.semana_id === semanaAbierta.id
                      ).length
                    : 0
                }
                maxJugadas={usuario.max_jugadas_semana}
                tableroCompleto={tableroCompleto}
                cantidadesSemanaActual={cantidadesSemanaActual}
                totalResultadosSemanaActual={
                  totalResultadosSemanaActual
                }
              />
            ))}

          {seccion === "usuarios" && esAdmin && (
            <UsuariosAdmin
              usuarios={usuarios}
              busqueda={busqueda}
              cargando={cargandoUsuarios}
              usuarioActual={usuario}
              onBusquedaChange={setBusqueda}
              onActualizar={cargarUsuarios}
              onAprobar={aprobarUsuario}
              onCambiarLimite={cambiarMaxJugadas}
              onCambiarEstado={cambiarEstadoUsuario}
              onEliminar={eliminarUsuario}
            />
          )}

          {seccion === "notificaciones" && esAdmin && (
            <NotificacionesAdmin />
          )}

          {seccion === "semanas" && esAdmin && (
            <section>
              <div className="barra-semanas">
                <button
                  className="boton-nuevo"
                  onClick={() => setMostrarNuevaSemana(true)}
                >
                  ＋ Nueva semana
                </button>

                <button onClick={cargarSemanas}>Actualizar</button>
              </div>

              {mostrarNuevaSemana && (
                <div className="formulario-semana">
                  <h2>Nueva semana</h2>

                  <label>
                    Nombre
                    <input
                      type="text"
                      value={nombreSemana}
                      onChange={(e) =>
                        setNombreSemana(e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Fecha de inicio
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) =>
                        setFechaInicio(e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Fecha final
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                    />
                  </label>

                  <label>
                    Pozo acumulado
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="Ejemplo: 3850000"
                      value={pozoSemana}
                      onChange={(e) => setPozoSemana(e.target.value)}
                    />
                  </label>

                  <div className="acciones-formulario">
                    <button
                      className="guardar"
                      onClick={crearSemana}
                    >
                      Guardar
                    </button>

                    <button
                      className="cancelar"
                      onClick={() =>
                        setMostrarNuevaSemana(false)
                      }
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {cargandoSemanas ? (
                <p>Cargando semanas...</p>
              ) : (
                <div className="tabla-contenedor">
                  <table className="tabla-usuarios">
                    <thead>
                      <tr>
                        <th>Semana</th>
                        <th>Inicio</th>
                        <th>Finalización</th>
                        <th>Pozo acumulado</th>
                        <th>Estado</th>
                        <th>Resultado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>

                    <tbody>
                      {semanas.map((semana) => (
                        <tr key={semana.id}>
                          <td>{semana.nombre}</td>
                          <td>{formatearFecha(semana.fecha_inicio)}</td>
                          <td>{formatearFecha(semana.fecha_fin)}</td>

                          <td>
                            <div className="pozo-tabla">
                              <strong>
                                {new Intl.NumberFormat("es-AR", {
                                  style: "currency",
                                  currency: "ARS",
                                  maximumFractionDigits: 0,
                                }).format(semana.pozo ?? 0)}
                              </strong>

                              <button
                                className="boton-editar-pozo"
                                onClick={() =>
                                  modificarPozoSemana(semana)
                                }
                              >
                                Editar
                              </button>
                            </div>
                          </td>

                          <td>
                            <span
                              className={
                                semana.estado === "abierta"
                                  ? "estado activo"
                                  : "estado inactivo"
                              }
                            >
                              {semana.estado}
                            </span>
                          </td>

                          <td>
                            <span className="estado">
                              {semana.resultado === "vacante"
                                ? "💰 Vacante"
                                : semana.resultado === "finalizada"
                                  ? "🏆 Con ganador"
                                  : "En curso"}
                            </span>
                          </td>

                          <td>
                            <div className="acciones-semana">
                              {semana.resultado === "en_curso" && (
                                <button
                                  className={
                                    semana.estado === "abierta"
                                      ? "boton-desactivar"
                                      : "boton-activar"
                                  }
                                  onClick={() => cambiarEstadoSemana(semana)}
                                >
                                  {semana.estado === "abierta"
                                    ? "🔒 Cerrar semana"
                                    : "🔓 Reabrir semana"}
                                </button>
                              )}

                              {semana.estado === "cerrada" &&
                                semana.resultado === "en_curso" && (
                                  <button
                                    className="boton-pozo-acumulado"
                                    disabled={procesandoCierreSemana === semana.id}
                                    onClick={() => cerrarYEvaluarSemana(semana)}
                                  >
                                    {procesandoCierreSemana === semana.id
                                      ? "Procesando..."
                                      : "💰 Declarar pozo acumulado"}
                                  </button>
                                )}

                              <button
                                className="boton-eliminar-definitivo"
                                onClick={() => eliminarSemana(semana)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {seccion === "jugadas" && (
            <JugadasPage
              usuarioActual={usuario}
              esAdmin={esAdmin}
              semanaAbierta={semanaAbierta}
              usuarios={usuarios}
              semanas={semanas}
              jugadas={jugadas}
              cargandoJugadas={cargandoJugadas}
              mostrarNuevaJugada={mostrarNuevaJugada}
              usuarioJugada={usuarioJugada}
              semanaJugada={semanaJugada}
              numeros={numeros}
              mensajeJugada={mensajeJugada}
              guardandoJugada={guardandoJugada}
              jugadaEditando={jugadaEditando}
              onMostrarNuevaJugada={() => {
                setJugadaEditando(null);
                setNumeros(numerosVacios());
                setMostrarNuevaJugada(true);
                setSemanaJugada(semanaAbierta?.id ?? "");
                setUsuarioJugada(esAdmin ? "" : usuario.id);
                setMensajeJugada("");
              }}
              onActualizar={cargarJugadas}
              onUsuarioJugadaChange={setUsuarioJugada}
              onSemanaJugadaChange={setSemanaJugada}
              onNumeroChange={cambiarNumero}
              onGuardar={guardarJugada}
              onGuardarDirecta={guardarJugadaDirecta}
              onCancelar={() => {
                setMostrarNuevaJugada(false);
                setJugadaEditando(null);
                setNumeros(numerosVacios());
              }}
              onEditar={editarJugada}
              onEliminar={eliminarJugada}
              obtenerEstadoCasilleros={obtenerEstadoCasilleros}
              jugadaEsGanadora={jugadaEsGanadora}
              nombreUsuario={nombreUsuario}
              nombreSemanaPorId={nombreSemanaPorId}
              pagoAprobado={pagoAprobado}
              obtenerComprobante={obtenerComprobante}
            />
          )}

          {seccion === "numeros" && esAdmin && (
            <section className="numeros-seccion">
              <div className="formulario-numero-salido">
                <h2>Cargar número salido</h2>

                <div className="aviso-resultados-semana-cerrada">
                  Podés cargar resultados aunque la semana esté cerrada.
                  El cierre bloquea solamente la creación y edición de jugadas.
                </div>

                <label>
                  Semana
                  <select
                    value={semanaNumeros}
                    onChange={(e) =>
                      setSemanaNumeros(e.target.value)
                    }
                  >
                    <option value="">Seleccionar semana</option>

                    {semanas.map((semana) => (
                      <option key={semana.id} value={semana.id}>
                        {semana.nombre} — {formatearFecha(semana.fecha_inicio)} al {formatearFecha(semana.fecha_fin)} — {semana.estado}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="fila-numero-salido">
                  <label>
                    Número
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="00"
                      value={nuevoNumeroSalido}
                      onChange={(e) =>
                        setNuevoNumeroSalido(
                          e.target.value
                            .replace(/\D/g, "")
                            .slice(0, 2)
                        )
                      }
                    />
                  </label>

                  <label>
                    Fecha
                    <input
                      type="date"
                      value={fechaNumeroSalido}
                      onChange={(e) =>
                        setFechaNumeroSalido(e.target.value)
                      }
                    />
                  </label>
                </div>

                <p className="ayuda-numeros-diarios">
                  Máximo 20 números por día. Solo de martes a sábado.
                </p>

                <button
                  className="guardar"
                  onClick={guardarNumeroSalido}
                  disabled={guardandoNumero}
                >
                  {guardandoNumero
                    ? "Guardando..."
                    : "Agregar número"}
                </button>
              </div>

              {mensajeNumero && (
                <p className="mensaje-jugadas">{mensajeNumero}</p>
              )}

              {cargandoNumeros ? (
                <p>Cargando números...</p>
              ) : (
                <div className="lista-numeros-salidos">
                  {numerosSalidos
                    .filter(
                      (item) => item.semana_id === semanaNumeros
                    )
                    .map((item) => (
                      <div
                        className="numero-salido-item"
                        key={item.id}
                      >
                        <span>{item.numero}</span>

                        <div>
                          <small>{formatearFecha(item.fecha)}</small>
                          <button
                            onClick={() =>
                              eliminarNumeroSalido(item)
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}

                  {numerosSalidos.filter(
                    (item) => item.semana_id === semanaNumeros
                  ).length === 0 && (
                    <div className="seccion-pendiente">
                      Todavía no hay números cargados para esta
                      semana.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {seccion === "comprobantes" && (
            <section className="comprobantes-seccion">
              {mensajeComprobante && (
                <div
                  role="alert"
                  aria-live="polite"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    margin: "0 0 24px",
                    padding: "18px 20px",
                    borderRadius: "14px",
                    border: mensajeComprobante.toLowerCase().includes("cerrada")
                      ? "2px solid #ef5350"
                      : "2px solid #39c56b",
                    background: mensajeComprobante.toLowerCase().includes("cerrada")
                      ? "rgba(211, 47, 47, 0.20)"
                      : "rgba(28, 160, 80, 0.18)",
                    color: mensajeComprobante.toLowerCase().includes("cerrada")
                      ? "#ff8a80"
                      : "#7ff0a5",
                    fontSize: "clamp(19px, 4.8vw, 24px)",
                    fontWeight: 800,
                    lineHeight: 1.35,
                    textAlign: "center",
                  }}
                >
                  {mensajeComprobante}
                </div>
              )}

              {!esAdmin && (
                <div className="formulario-comprobante">
                  <h2>Enviar comprobante de pago</h2>

                  <label>
                    Semana
                    <select
                      value={semanaComprobante}
                      onChange={(e) =>
                        setSemanaComprobante(e.target.value)
                      }
                    >
                      <option value="">Seleccionar semana</option>

                      {semanas.map((semana) => (
                        <option key={semana.id} value={semana.id}>
                          {semana.nombre} — {semana.estado}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Archivo JPG, PNG o PDF
                    <input
                      key={reinicioArchivoComprobante}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={(e) =>
                        setArchivoComprobante(
                          e.target.files?.[0] ?? null
                        )
                      }
                    />
                  </label>

                  <p className="ayuda-comprobante">
                    Tamaño máximo: 10 MB. Podés reemplazarlo únicamente
                    mientras la semana esté abierta.
                  </p>

                  <button
                    className="guardar"
                    onClick={subirComprobante}
                    disabled={subiendoComprobante}
                  >
                    {subiendoComprobante
                      ? "Subiendo..."
                      : "Enviar comprobante"}
                  </button>

                  {mensajeExitoComprobante && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      style={{
                        marginTop: "16px",
                        padding: "16px",
                        borderRadius: "12px",
                        border: "2px solid #39c56b",
                        background: "rgba(28, 160, 80, 0.20)",
                        color: "#7ff0a5",
                        fontSize: "18px",
                        fontWeight: 800,
                        lineHeight: 1.4,
                        textAlign: "center",
                      }}
                    >
                      {mensajeExitoComprobante}
                    </div>
                  )}
                </div>
              )}

              <div className="barra-comprobantes">
                <h2>
                  {esAdmin
                    ? "Administración de comprobantes"
                    : "Mis comprobantes"}
                </h2>

                <div className="acciones-cabecera-comprobantes">
                  {esAdmin && (
                    <>
                      <button
                        className="boton-aprobar-todos"
                        onClick={aprobarTodosLosComprobantes}
                        disabled={comprobantesPendientes.length === 0}
                      >
                        ✅ Aprobar todos (
                        {comprobantesPendientes.length})
                      </button>

                      <button
                        className="boton-habilitar-manual-visible"
                        onClick={() =>
                          setMostrarHabilitacionManual(
                            (mostrar) => !mostrar
                          )
                        }
                      >
                        {mostrarHabilitacionManual
                          ? "Ocultar habilitación manual"
                          : "Habilitar manualmente"}
                      </button>
</>
                  )}

                  <button onClick={cargarComprobantes}>
                    Actualizar
                  </button>
                </div>
              </div>

              {esAdmin && (
                <>
                  <section className="resumen-comprobantes-admin">
                    <div className="resumen-comprobante pendiente">
                      <span>Pendientes</span>
                      <strong>{comprobantesPendientes.length}</strong>
                    </div>

                    <div className="resumen-comprobante aprobado">
                      <span>Aprobados</span>
                      <strong>{comprobantesAprobados.length}</strong>
                    </div>

                    <div className="resumen-comprobante rechazado">
                      <span>Rechazados</span>
                      <strong>{comprobantesRechazados.length}</strong>
                    </div>

                    <div className="resumen-comprobante manual">
                      <span>Habilitados manualmente</span>
                      <strong>{habilitadosManualmente}</strong>
                    </div>
                  </section>

                  <section className="exportacion-comprobantes-admin">
                    <div>
                      <h3>Exportar comprobantes</h3>
                      <p>
                        Genera un ZIP con archivos, resumen y usuarios
                        habilitados manualmente.
                      </p>
                    </div>

                    <select
                      value={semanaExportacion}
                      onChange={(e) =>
                        setSemanaExportacion(e.target.value)
                      }
                    >
                      <option value="">Seleccionar semana</option>
                      {semanas.map((semana) => (
                        <option key={semana.id} value={semana.id}>
                          {semana.nombre} — {semana.estado}
                        </option>
                      ))}
                    </select>

                    <select
                      value={estadoExportacion}
                      onChange={(e) =>
                        setEstadoExportacion(e.target.value)
                      }
                    >
                      <option value="todos">Todos los estados</option>
                      <option value="pendiente">Solo pendientes</option>
                      <option value="aprobado">Solo aprobados</option>
                      <option value="rechazado">Solo rechazados</option>
                    </select>

                    <button
                      className="boton-exportar-zip"
                      onClick={exportarComprobantesZip}
                      disabled={exportandoComprobantes}
                    >
                      {exportandoComprobantes
                        ? "Generando ZIP..."
                        : "📦 Exportar ZIP"}
                    </button>
                  </section>

                  <div className="buscador-comprobantes-admin">
                    <input
                      type="text"
                      placeholder="Buscar por nombre, correo, semana o estado"
                      value={busquedaComprobante}
                      onChange={(e) =>
                        setBusquedaComprobante(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setBusquedaComprobanteAplicada(
                            busquedaComprobante
                          );
                          setPaginaPendientes(1);
                          setPaginaAnteriores(1);
                          setPaginaHabilitacion(1);
                        }
                      }}
                    />

                    <button
                      onClick={() => {
                        setBusquedaComprobanteAplicada(
                          busquedaComprobante
                        );
                        setPaginaPendientes(1);
                        setPaginaAnteriores(1);
                        setPaginaHabilitacion(1);
                      }}
                    >
                      Buscar
                    </button>

                    <button
                      className="boton-limpiar-busqueda"
                      onClick={() => {
                        setBusquedaComprobante("");
                        setBusquedaComprobanteAplicada("");
                        setPaginaPendientes(1);
                        setPaginaAnteriores(1);
                        setPaginaHabilitacion(1);
                      }}
                    >
                      Limpiar
                    </button>
                  </div>

                  {mostrarHabilitacionManual && (
                  <section className="habilitacion-manual-comprobantes">
                    <div className="habilitacion-manual-titulo">
                      <div>
                        <h3>Habilitar sin comprobante</h3>
                        <p>
                          Autorización excepcional para la semana elegida.
                        </p>
                      </div>

                      <div className="acciones-habilitacion-cabecera">
                        <select
                          value={semanaHabilitacion}
                          onChange={(e) => {
                            setSemanaHabilitacion(e.target.value);
                            setPaginaHabilitacion(1);
                          }}
                        >
                          <option value="">Seleccionar semana</option>
                          {semanas.map((semana) => (
                            <option key={semana.id} value={semana.id}>
                              {semana.nombre} — {semana.estado}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {mostrarHabilitacionManual && (
                      <>
                        <div className="tabla-habilitacion-manual">
                          <div className="fila-habilitacion-manual encabezado">
                            <span>Usuario</span>
                            <span>Correo</span>
                            <span>Estado</span>
                            <span>Acción</span>
                          </div>

                          {usuariosHabilitacionPaginados.map((item) => {
                            const habilitado = semanaHabilitacion
                              ? habilitacionManualActiva(
                                  item.id,
                                  semanaHabilitacion
                                )
                              : false;

                            const comprobanteAprobado =
                              semanaHabilitacion
                                ? obtenerComprobante(
                                    item.id,
                                    semanaHabilitacion
                                  )?.estado === "aprobado"
                                : false;

                            return (
                              <div
                                className="fila-habilitacion-manual"
                                key={item.id}
                              >
                                <strong>{item.nombre}</strong>
                                <span>{item.email}</span>

                                <span
                                  className={
                                    comprobanteAprobado || habilitado
                                      ? "estado activo"
                                      : "estado inactivo"
                                  }
                                >
                                  {comprobanteAprobado
                                    ? "Pago aprobado"
                                    : habilitado
                                      ? "Manual"
                                      : "No habilitado"}
                                </span>

                                {!comprobanteAprobado ? (
                                  <button
                                    className={
                                      habilitado
                                        ? "boton-desactivar boton-compacto"
                                        : "boton-activar boton-compacto"
                                    }
                                    disabled={!semanaHabilitacion}
                                    onClick={() =>
                                      cambiarHabilitacionManual(
                                        item.id,
                                        semanaHabilitacion,
                                        !habilitado
                                      )
                                    }
                                  >
                                    {habilitado
                                      ? "Revocar"
                                      : "Habilitar"}
                                  </button>
                                ) : (
                                  <span>—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {usuariosHabilitacionFiltrados.length > 0 && (
                          <div className="paginacion-comprobantes">
                            <span>
                              Mostrando{" "}
                              {textoRango(
                                paginaHabilitacion,
                                usuariosHabilitacionFiltrados.length
                              )}{" "}
                              de {usuariosHabilitacionFiltrados.length}
                            </span>

                            <div>
                              <button
                                disabled={paginaHabilitacion <= 1}
                                onClick={() =>
                                  setPaginaHabilitacion((pagina) =>
                                    Math.max(1, pagina - 1)
                                  )
                                }
                              >
                                Anterior
                              </button>

                              <span>
                                {paginaHabilitacion}/
                                {totalPaginasHabilitacion}
                              </span>

                              <button
                                disabled={
                                  paginaHabilitacion >=
                                  totalPaginasHabilitacion
                                }
                                onClick={() =>
                                  setPaginaHabilitacion((pagina) =>
                                    Math.min(
                                      totalPaginasHabilitacion,
                                      pagina + 1
                                    )
                                  )
                                }
                              >
                                Siguiente
                              </button>
                            </div>
                          </div>
                        )}
</>
                    )}
                  </section>
                  )}
</>
              )}

              {cargandoComprobantes ? (
                <p>Cargando comprobantes...</p>
              ) : esAdmin ? (
                <>
                  <div className="titulo-listado-compacto">
                    <h3>Pendientes de aprobación</h3>
                    <span>
                      Mostrando{" "}
                      {textoRango(
                        paginaPendientes,
                        comprobantesPendientes.length
                      )}{" "}
                      de {comprobantesPendientes.length}
                    </span>
                  </div>

                  <div className="tabla-comprobantes-compacta">
                    <div className="fila-comprobante encabezado">
                      <span>Usuario</span>
                      <span>Semana</span>
                      <span>Fecha</span>
                      <span>Archivo</span>
                      <span>Observación</span>
                      <span>Acciones</span>
                    </div>

                    {pendientesPaginados.map((item) => (
                      <div className="fila-comprobante" key={item.id}>
                        <strong>{nombreUsuario(item.usuario_id)}</strong>
                        <span>{nombreSemanaPorId(item.semana_id)}</span>
                        <small>
                          {formatearFechaHora(item.created_at)}
                        </small>

                        <button
                          className="boton-ver-archivo boton-compacto"
                          onClick={() => abrirComprobante(item)}
                        >
                          Ver
                        </button>

                        <input
                          className="observacion-compacta"
                          type="text"
                          placeholder="Observación"
                          value={
                            observacionesComprobantes[item.id] ?? ""
                          }
                          onChange={(e) =>
                            setObservacionesComprobantes(
                              (actuales) => ({
                                ...actuales,
                                [item.id]: e.target.value,
                              })
                            )
                          }
                        />

                        <div className="acciones-compactas">
                          <button
                            className="boton-activar boton-compacto"
                            onClick={() =>
                              revisarComprobante(item, "aprobado")
                            }
                          >
                            Aprobar
                          </button>

                          <button
                            className="boton-desactivar boton-compacto"
                            onClick={() =>
                              revisarComprobante(item, "rechazado")
                            }
                          >
                            Rechazar
                          </button>
                        </div>
                      </div>
                    ))}

                    {comprobantesPendientes.length === 0 && (
                      <div className="sin-registros-compacto">
                        No hay comprobantes pendientes.
                      </div>
                    )}
                  </div>

                  {comprobantesPendientes.length > 0 && (
                    <div className="paginacion-comprobantes">
                      <span>
                        Página {paginaPendientes} de{" "}
                        {totalPaginasPendientes}
                      </span>

                      <div>
                        <button
                          disabled={paginaPendientes <= 1}
                          onClick={() =>
                            setPaginaPendientes((pagina) =>
                              Math.max(1, pagina - 1)
                            )
                          }
                        >
                          Anterior
                        </button>

                        <button
                          disabled={
                            paginaPendientes >=
                            totalPaginasPendientes
                          }
                          onClick={() =>
                            setPaginaPendientes((pagina) =>
                              Math.min(
                                totalPaginasPendientes,
                                pagina + 1
                              )
                            )
                          }
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="titulo-comprobantes-anteriores">
                    <h2>Comprobantes anteriores</h2>
                    <span>
                      {comprobantesAnteriores.length} registros
                    </span>
                  </div>

                  <div className="historial-comprobantes">
                    <div className="historial-comprobantes-encabezado">
                      <span>Usuario</span>
                      <span>Semana</span>
                      <span>Fecha</span>
                      <span>Estado</span>
                      <span>Archivo</span>
                    </div>

                    {anterioresPaginados.map((item) => (
                      <div
                        className="fila-comprobante-anterior"
                        key={item.id}
                      >
                        <strong>
                          {nombreUsuario(item.usuario_id)}
                        </strong>
                        <span>
                          {nombreSemanaPorId(item.semana_id)}
                        </span>
                        <span>
                          {formatearFechaHora(item.created_at)}
                        </span>
                        <span
                          className={`estado-comprobante ${item.estado}`}
                        >
                          {item.estado === "aprobado"
                            ? "Aprobado"
                            : "Rechazado"}
                        </span>
                        <button
                          className="boton-ver-archivo boton-compacto"
                          onClick={() => abrirComprobante(item)}
                        >
                          Ver
                        </button>
                      </div>
                    ))}

                    {comprobantesAnteriores.length === 0 && (
                      <div className="sin-registros-compacto">
                        Todavía no hay comprobantes anteriores.
                      </div>
                    )}
                  </div>

                  {comprobantesAnteriores.length > 0 && (
                    <div className="paginacion-comprobantes">
                      <span>
                        Mostrando{" "}
                        {textoRango(
                          paginaAnteriores,
                          comprobantesAnteriores.length
                        )}{" "}
                        de {comprobantesAnteriores.length}
                      </span>

                      <div>
                        <button
                          disabled={paginaAnteriores <= 1}
                          onClick={() =>
                            setPaginaAnteriores((pagina) =>
                              Math.max(1, pagina - 1)
                            )
                          }
                        >
                          Anterior
                        </button>

                        <span>
                          {paginaAnteriores}/{totalPaginasAnteriores}
                        </span>

                        <button
                          disabled={
                            paginaAnteriores >= totalPaginasAnteriores
                          }
                          onClick={() =>
                            setPaginaAnteriores((pagina) =>
                              Math.min(
                                totalPaginasAnteriores,
                                pagina + 1
                              )
                            )
                          }
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  )}
</>
              ) : (
                <div className="lista-comprobantes">
                  {comprobantes.map((item) => {
                    const semana = semanas.find(
                      (dato) => dato.id === item.semana_id
                    );
                    const semanaEstaAbierta =
                      semana?.estado === "abierta";

                    return (
                      <article
                        className="tarjeta-comprobante"
                        key={item.id}
                      >
                        <div className="comprobante-cabecera">
                          <div>
                            <h3>
                              {nombreSemanaPorId(item.semana_id)}
                            </h3>
                            <small>
                              Enviado:{" "}
                              {formatearFechaHora(item.created_at)}
                            </small>
                          </div>

                          <span
                            className={`estado-comprobante ${item.estado}`}
                          >
                            {item.estado === "pendiente" && "Pendiente"}
                            {item.estado === "aprobado" && "Aprobado"}
                            {item.estado === "rechazado" && "Rechazado"}
                          </span>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: "12px",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="boton-ver-archivo boton-compacto"
                            onClick={() => abrirComprobante(item)}
                          >
                            Ver archivo
                          </button>

                          {semanaEstaAbierta && (
                            <button
                              className="boton-eliminar-definitivo boton-compacto"
                              onClick={() => eliminarComprobanteUsuario(item)}
                            >
                              Eliminar comprobante
                            </button>
                          )}
                        </div>

                        {item.observacion && (
                          <div className="observacion-usuario">
                            <strong>
                              Observación del administrador:
                            </strong>
                            <p>{item.observacion}</p>
                          </div>
                        )}

                        {!semanaEstaAbierta && (
                          <div className="edicion-bloqueada">
                            🔒 Semana cerrada: comprobante en modo consulta
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {comprobantes.length === 0 && (
                    <div className="seccion-pendiente">
                      Todavía no hay comprobantes cargados.
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {seccion !== "dashboard" &&
            seccion !== "usuarios" &&
            seccion !== "semanas" &&
            seccion !== "jugadas" &&
            seccion !== "numeros" &&
            seccion !== "comprobantes" && (
              <div className="seccion-pendiente">
                Esta sección se construirá próximamente.
              </div>
            )}

          <footer className="footer-legal footer-contenido">
            <strong>La Polla</strong> es un entretenimiento. Este sistema está destinado exclusivamente a la organización de jugadas entre compañeros. No constituye una plataforma pública de apuestas.
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="login-card">
        <h1>LA POLLA</h1>

        <p>
          {modoRegistro
            ? "Creá tu cuenta para cargar jugadas"
            : "Sistema privado de jugadas semanales"}
        </p>

        {modoRegistro && (
          <input
            type="text"
            placeholder="Nombre y apellido"
            value={nombreRegistro}
            onChange={(e) =>
              setNombreRegistro(e.target.value)
            }
          />
        )}

        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !modoRegistro) login();
          }}
        />

        {modoRegistro && (
          <input
            type="password"
            placeholder="Confirmar contraseña"
            value={confirmarPassword}
            onChange={(e) =>
              setConfirmarPassword(e.target.value)
            }
          />
        )}

        <button
          onClick={modoRegistro ? registrarse : login}
          disabled={cargando}
        >
          {cargando
            ? "Procesando..."
            : modoRegistro
              ? "Crear cuenta"
              : "Ingresar"}
        </button>

        <button
          type="button"
          className="boton-secundario"
          onClick={() => {
            setModoRegistro(!modoRegistro);
            setMensaje("");
            setPassword("");
            setConfirmarPassword("");
          }}
        >
          {modoRegistro
            ? "Ya tengo cuenta"
            : "Registrarme"}
        </button>

        {mensaje && <p className="mensaje">{mensaje}</p>}
      <footer className="footer-legal footer-login">
        <strong>La Polla</strong> es un entretenimiento. Este sistema está destinado exclusivamente a la organización de jugadas entre compañeros. No constituye una plataforma pública de apuestas.
      </footer>
      </div>
    </div>
  );
}

export default App;
