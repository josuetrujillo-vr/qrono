# Publicar Qrono en tus cuentas

Repositorio: https://github.com/josuetrujillo-vr/qrono

Proyecto Supabase: `ehvbnwqeedqylblsjxpr` · https://ehvbnwqeedqylblsjxpr.supabase.co

La URL y la referencia del proyecto son públicas. Las claves no se guardan en este repositorio. No introduzcas la service role ni un token de administración en Cloudflare Pages o en variables VITE_.

## Crear Cloudflare Pages conectado a GitHub

1. Abre https://dash.cloudflare.com/ y entra en **Workers & Pages**.
2. Elige **Create application** y después **Pages / Get started / Connect to Git**. Si se abre el asistente de Workers, cambia a la opción de Pages.
3. Conecta GitHub y autoriza únicamente el repositorio `josuetrujillo-vr/qrono`.
4. Selecciona ese repositorio. Nombre de proyecto sugerido: `qrono`; rama de producción: `main`.
5. Framework: **Vite**. Comando: `npm run build`. Directorio de salida: `dist`. Directorio raíz: vacío.
6. Agrega las variables de compilación de producción:

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `22` |
| `VITE_SUPABASE_URL` | `https://ehvbnwqeedqylblsjxpr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anon o publishable de este proyecto, desde Supabase → Settings → API Keys |
| `VITE_APP_URL` | URL definitiva que asigne Pages, por ejemplo `https://qrono.pages.dev` si está disponible |

7. Publica. Si la URL final resulta distinta, corrige `VITE_APP_URL` y vuelve a desplegar. La clave pública llega al navegador por diseño; la protección de datos depende de RLS. No uses claves secret o service_role en esa casilla.
8. Cada push a `main` generará un nuevo despliegue automáticamente.

Guía oficial: https://developers.cloudflare.com/pages/get-started/git-integration/

## Configurar Supabase

En una terminal privada, desde este proyecto:

```powershell
npx supabase login
npx supabase link --project-ref ehvbnwqeedqylblsjxpr
npx supabase db push --dry-run
```

Inspecciona primero el estado existente del proyecto. La migración crea tablas y permisos del MVP; no la apliques sobre tablas homónimas de otra aplicación. No ejecutes `db reset`, `--include-seed` ni el seed demo en este proyecto remoto.

Después de verificar la migración:

```powershell
npx supabase db push
npx supabase secrets set APP_URL=https://URL_DEFINITIVA.pages.dev
npx supabase functions deploy qr-token --project-ref ehvbnwqeedqylblsjxpr
npx supabase functions deploy checkin --project-ref ehvbnwqeedqylblsjxpr
npx supabase functions deploy admin-members --project-ref ehvbnwqeedqylblsjxpr
```

La plataforma inyecta sus claves internas en las funciones. En Auth configura la URL del sitio con el origen definitivo, registro público deshabilitado y mínimo de contraseña 6 para los PIN. Conserva intactos otros ajustes de un proyecto existente: no uses `config push` con el archivo local, que contiene URLs localhost.

Crea tu primera empresa/propietario con el bootstrap del README, publicando después textos legales revisados. Finalmente prueba una marca QR, otra por PIN, historial, exportaciones y aislamiento entre dos empresas de prueba. Las cuentas de demo local no existen en el servidor remoto.

Para permitir que el agente despliegue desde CLI, inicia también `npx wrangler login`. Ambas autorizaciones se completan en el navegador. No pegues tokens ni contraseñas en el chat.
