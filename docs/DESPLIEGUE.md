# Despliegue de Qrono

## Instalación publicada

La aplicación ya está en **https://qrono.pages.dev**. Se instaló la migración `202611140001_core.sql` y las tres funciones en el proyecto Supabase indicado abajo, sin seed demo. Auth tiene registro público deshabilitado y URL del sitio `https://qrono.pages.dev`; otros ajustes se conservaron.

Pages usa **subida directa**: la integración GitHub respondió con el error 8000011 sobre su instalación Git. Por ello, un push a GitHub **no publica automáticamente la web**. Desde esta computadora, con las variables de producción en `.env.production.local` (ignorado por Git):

```powershell
npx wrangler login
npm run deploy:pages
```

El script compila y publica con `wrangler@4.162.0 pages deploy dist --project-name qrono --branch main --force`. En esta versión, `--force` elige Pages clásico y evita delegar a Workers; no cambia Git ni la base. Encuentra el proyecto en Cloudflare → Workers & Pages → qrono.

El archivo privado de compilación contiene `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_APP_URL=https://qrono.pages.dev`. No lo subas a Git. Las variables públicas también están guardadas en Pages, pero la compilación de subida directa usa las locales.

La configuración remota mínima está en `deploy/supabase/config.toml`. Para revisarla y aplicarla:

```powershell
npx supabase config diff --workdir deploy --remote=TU_REFERENCIA
npx supabase config push --workdir deploy --remote=TU_REFERENCIA --yes
```

El segundo comando se ejecuta solo después de revisar el diff. Las funciones declaran el mapa compartido de imports. Para actualizarlas sin Docker:

```powershell
npx supabase functions deploy qr-token checkin admin-members --remote=TU_REFERENCIA --import-map supabase/functions/deno.json --use-api --yes
```

El acceso inicial del administrador se entregó en un archivo privado bajo `.local/`, excluido de Git. El correo sintético es solo un identificador y no recibe mensajes. Conserva la contraseña en privado. Antes del uso real, reemplaza los documentos REVISAR CON ABOGADO y agrega empleados/quioscos desde Administración.

## Alternativa futura: integración Git

Los pasos siguientes son para crear **otro proyecto** con despliegue automático, después de autorizar la aplicación GitHub de Cloudflare. El proyecto actual de subida directa no se convierte a Git; usa una URL nueva y actualiza el origen permitido en Supabase si eliges esta alternativa.

Repositorio: https://github.com/josuetrujillo-vr/qrono

La referencia y URL reales del proyecto se mantienen en la configuración local y en el entorno de despliegue. Los ejemplos usan `TU_REFERENCIA`.

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
| `VITE_SUPABASE_URL` | `https://TU_REFERENCIA.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave anon o publishable de este proyecto, desde Supabase → Settings → API Keys |
| `VITE_APP_URL` | URL definitiva que asigne Pages, por ejemplo `https://qrono.pages.dev` si está disponible |

7. Publica. Si la URL final resulta distinta, corrige `VITE_APP_URL` y vuelve a desplegar. La clave pública llega al navegador por diseño; la protección de datos depende de RLS. No uses claves secret o service_role en esa casilla.
8. Cada push a `main` generará un nuevo despliegue automáticamente.

Guía oficial: https://developers.cloudflare.com/pages/get-started/git-integration/

## Configurar Supabase

En una terminal privada, desde este proyecto:

```powershell
npx supabase login
npx supabase link --project-ref TU_REFERENCIA
npx supabase db push --dry-run
```

Inspecciona primero el estado existente del proyecto. La migración crea tablas y permisos del MVP; no la apliques sobre tablas homónimas de otra aplicación. No ejecutes `db reset`, `--include-seed` ni el seed demo en este proyecto remoto.

Después de verificar la migración:

```powershell
npx supabase db push
npx supabase secrets set APP_URL=https://URL_DEFINITIVA.pages.dev
npx supabase functions deploy qr-token --project-ref TU_REFERENCIA
npx supabase functions deploy checkin --project-ref TU_REFERENCIA
npx supabase functions deploy admin-members --project-ref TU_REFERENCIA
```

La plataforma inyecta sus claves internas en las funciones. En Auth configura la URL del sitio con el origen definitivo, registro público deshabilitado y mínimo de contraseña 6 para los PIN. Conserva intactos otros ajustes de un proyecto existente: no uses `config push` con el archivo local, que contiene URLs localhost.

Crea tu primera empresa/propietario con el bootstrap del README, publicando después textos legales revisados. Finalmente prueba una marca QR, otra por PIN, historial, exportaciones y aislamiento entre dos empresas de prueba. Las cuentas de demo local no existen en el servidor remoto.

Para permitir que el agente despliegue desde CLI, inicia también `npx wrangler login`. Ambas autorizaciones se completan en el navegador. No pegues tokens ni contraseñas en el chat.
