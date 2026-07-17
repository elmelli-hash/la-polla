import type { Usuario } from "../../types";

type Props = {
  usuarios: Usuario[];
  busqueda: string;
  cargando: boolean;
  usuarioActual: Usuario;
  onBusquedaChange: (valor: string) => void;
  onActualizar: () => void;
  onAprobar: (usuario: Usuario) => void;
  onCambiarLimite: (usuario: Usuario, cantidad: number) => void;
  onCambiarEstado: (usuario: Usuario) => void;
  onEliminar: (usuario: Usuario) => void;
};

function UsuariosAdmin({
  usuarios,
  busqueda,
  cargando,
  usuarioActual,
  onBusquedaChange,
  onActualizar,
  onAprobar,
  onCambiarLimite,
  onCambiarEstado,
  onEliminar,
}: Props) {
  const texto = busqueda.toLowerCase();

  const usuariosFiltrados = usuarios.filter(
    (item) =>
      item.nombre.toLowerCase().includes(texto) ||
      item.email.toLowerCase().includes(texto)
  );

  return (
    <section>
      <div className="barra-usuarios">
        <input
          type="text"
          placeholder="Buscar por nombre o correo"
          value={busqueda}
          onChange={(e) => onBusquedaChange(e.target.value)}
        />

        <button onClick={onActualizar}>Actualizar</button>
      </div>

      {cargando ? (
        <p>Cargando usuarios...</p>
      ) : (
        <div className="tabla-contenedor">
          <table className="tabla-usuarios">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Aprobación</th>
                <th>Jugadas por semana</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuariosFiltrados.map((item) => (
                <tr key={item.id}>
                  <td>{item.nombre}</td>
                  <td>{item.email}</td>

                  <td>
                    <span
                      className={
                        item.aprobado
                          ? "estado activo"
                          : "estado pendiente"
                      }
                    >
                      {item.aprobado ? "Aprobado" : "Pendiente"}
                    </span>
                  </td>

                  <td>
                    <select
                      className="selector-limite"
                      value={item.max_jugadas_semana}
                      onChange={(e) =>
                        onCambiarLimite(item, Number(e.target.value))
                      }
                      disabled={item.rol === "admin"}
                    >
                      {[1, 2, 3, 4, 5].map((cantidad) => (
                        <option key={cantidad} value={cantidad}>
                          {cantidad}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <span
                      className={
                        item.habilitado
                          ? "estado activo"
                          : "estado inactivo"
                      }
                    >
                      {item.habilitado
                        ? "Habilitado"
                        : "Deshabilitado"}
                    </span>
                  </td>

                  <td>
                    <div className="acciones-usuario">
                      {!item.aprobado && (
                        <button
                          className="boton-activar"
                          onClick={() => onAprobar(item)}
                        >
                          Aprobar
                        </button>
                      )}

                      <button
                        className={
                          item.habilitado
                            ? "boton-desactivar"
                            : "boton-activar"
                        }
                        onClick={() => onCambiarEstado(item)}
                        disabled={
                          item.email.toLowerCase() ===
                          usuarioActual.email.toLowerCase()
                        }
                      >
                        {item.habilitado
                          ? "Deshabilitar"
                          : "Habilitar"}
                      </button>

                      {item.id !== usuarioActual.id && (
                        <button
                          className="boton-eliminar-definitivo"
                          onClick={() => onEliminar(item)}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default UsuariosAdmin;
