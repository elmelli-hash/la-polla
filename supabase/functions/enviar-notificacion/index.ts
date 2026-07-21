import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cert, getApps, initializeApp } from "npm:firebase-admin/app";
import { getMessaging } from "npm:firebase-admin/messaging";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Destino = "todos" | "usuarios" | "administradores";

type Cuerpo = {
  titulo?: string;
  mensaje?: string;
  destino?: Destino;
  url?: string;
};

const responder = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountText = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");

    if (!supabaseUrl || !serviceRoleKey || !serviceAccountText) {
      return responder(
        {
          exito: false,
          mensaje:
            "Faltan secretos de Supabase o Firebase en la función enviar-notificacion.",
        },
        500
      );
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return responder({ exito: false, mensaje: "Sesión no válida." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const tokenSesion = authorization.replace(/^Bearer\s+/i, "");
    const { data: authData, error: authError } = await admin.auth.getUser(tokenSesion);

    if (authError || !authData.user) {
      return responder({ exito: false, mensaje: "Sesión no válida." }, 401);
    }

    const { data: perfil, error: perfilError } = await admin
      .from("usuarios")
      .select("id, rol")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (perfilError || perfil?.rol !== "admin") {
      return responder(
        { exito: false, mensaje: "Solo un administrador puede enviar avisos." },
        403
      );
    }

    const cuerpo = (await req.json()) as Cuerpo;
    const titulo = cuerpo.titulo?.trim() ?? "";
    const mensaje = cuerpo.mensaje?.trim() ?? "";
    const destino: Destino = cuerpo.destino ?? "usuarios";
    const url = cuerpo.url?.trim() || "/";

    if (!titulo || !mensaje || titulo.length > 80 || mensaje.length > 240) {
      return responder(
        { exito: false, mensaje: "El título o el mensaje no son válidos." },
        400
      );
    }

    let consulta = admin
      .from("dispositivos_notificaciones")
      .select("token, usuario_id, usuarios!inner(rol)")
      .eq("activo", true);

    if (destino === "usuarios") {
      consulta = consulta.eq("usuarios.rol", "usuario");
    } else if (destino === "administradores") {
      consulta = consulta.eq("usuarios.rol", "admin");
    }

    const { data: dispositivos, error: dispositivosError } = await consulta;

    if (dispositivosError) {
      return responder(
        {
          exito: false,
          mensaje: "No se pudieron consultar los dispositivos: " + dispositivosError.message,
        },
        500
      );
    }

    const tokens = [...new Set((dispositivos ?? []).map((item) => item.token).filter(Boolean))];

    if (tokens.length === 0) {
      return responder({
        exito: true,
        mensaje: "No hay dispositivos activos para esos destinatarios.",
        enviados: 0,
        fallidos: 0,
      });
    }

    const serviceAccount = JSON.parse(serviceAccountText);

    if (getApps().length === 0) {
      initializeApp({ credential: cert(serviceAccount) });
    }

    const messaging = getMessaging();
    let enviados = 0;
    let fallidos = 0;
    const tokensInvalidos: string[] = [];

    for (let i = 0; i < tokens.length; i += 500) {
      const lote = tokens.slice(i, i + 500);
      const respuesta = await messaging.sendEachForMulticast({
        tokens: lote,
        notification: { title: titulo, body: mensaje },
        data: { url },
        webpush: {
          fcmOptions: { link: url },
          notification: {
            icon: "/icons/icon-192.png",
            badge: "/icons/icon-192.png",
          },
        },
      });

      enviados += respuesta.successCount;
      fallidos += respuesta.failureCount;

      respuesta.responses.forEach((resultado, indice) => {
        const codigo = resultado.error?.code ?? "";
        if (
          codigo.includes("registration-token-not-registered") ||
          codigo.includes("invalid-registration-token")
        ) {
          tokensInvalidos.push(lote[indice]);
        }
      });
    }

    if (tokensInvalidos.length > 0) {
      await admin
        .from("dispositivos_notificaciones")
        .update({ activo: false, updated_at: new Date().toISOString() })
        .in("token", tokensInvalidos);
    }

    return responder({
      exito: true,
      mensaje: "Notificación procesada correctamente.",
      enviados,
      fallidos,
    });
  } catch (error) {
    console.error(error);
    return responder(
      {
        exito: false,
        mensaje: error instanceof Error ? error.message : "Error inesperado.",
      },
      500
    );
  }
});
