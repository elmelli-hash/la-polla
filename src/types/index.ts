export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: "admin" | "usuario";
  habilitado: boolean;
  aprobado: boolean;
  max_jugadas_semana: number;
};

export type Semana = {
  id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: "abierta" | "cerrada";
  pozo: number;
  resultado?: "en_curso" | "finalizada" | "vacante";
  semana_origen_id?: string | null;
  pozo_arrastrado?: number;
};

export type Jugada = {
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
  heredada?: boolean;
  jugada_origen_id?: string | null;
  created_at?: string;
};

export type NumeroSalido = {
  id: string;
  semana_id: string;
  numero: string;
  fecha: string;
  created_at?: string;
};

export type Comprobante = {
  id: string;
  usuario_id: string;
  semana_id: string;
  archivo_url: string;
  estado: "pendiente" | "aprobado" | "rechazado";
  observacion: string | null;
  created_at?: string;
};


export type AutorizacionJuego = {
  id: string;
  usuario_id: string;
  semana_id: string;
  autorizado: boolean;
  motivo: string | null;
  created_at?: string;
};

export type Seccion =
  | "dashboard"
  | "usuarios"
  | "semanas"
  | "jugadas"
  | "numeros"
  | "comprobantes";
