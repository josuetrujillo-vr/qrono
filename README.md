# Qrono

MVP de registro de jornada para equipos pequeños: React/TypeScript, Supabase Auth, PostgreSQL, Edge Functions y hosting estático. Interfaz en español. No incorpora biometría, geolocalización, cola offline ni cálculo legal de horas extra.

## Estado y verificación

El código incluye las seis fases del documento `docs/especificacion.md`. El despliegue y la integración con Supabase real necesitan las cuentas del responsable. Las pruebas SQL locales usan PostgreSQL 17 real con un esquema Auth mínimo: verifican SQL y permisos, pero no sustituyen probar GoTrue/PostgREST/Edge en Supabase. Las pruebas Playwright simulan sus contratos HTTP. Pruebe cámara, instalación y Wake Lock en la tablet/teléfono finales.

## Desarrollo local

Requisitos: Node 22.12+ y npm, Docker Desktop y Supabase CLI para la plataforma completa.

```powershell
npm ci
npx supabase start
npx supabase db reset
Copy-Item .env.example .env
Copy-Item supabase/.env.example supabase/.env
```

Obtenga URL y `anon key` con `npx supabase status`; complete exclusivamente las variables `VITE_` públicas en `.env`. Use el mismo origen en `VITE_APP_URL` y `APP_URL`: `http://localhost:5173`. La URL local de Supabase es `http://127.0.0.1:54321`.

En dos terminales:

```powershell
npx supabase functions serve --env-file supabase/.env
npm run dev
```

El CLI proporciona URL y claves de Supabase a las funciones. El mínimo de contraseña local es 6; el registro público está deshabilitado. Las funciones comprueban el JWT con `auth.getUser` aunque el gateway tenga `verify_jwt=false` para admitir las claves actuales de Supabase. CORS admite únicamente el origen configurado en `APP_URL`.

### Demo local

El seed es exclusivamente para desarrollo. Crea el propietario `admin@demo.checador.local`, el quiosco `quiosco@demo.checador.local` y empleados de empresa `demo`, números `001` a `005`, con contraseñas aleatorias no recuperables. Para habilitar su acceso, defina la clave service role **local** en `SUPABASE_SERVICE_ROLE_KEY` y ejecute `node scripts/setup-demo.mjs`. Las credenciales generadas quedan en `.local/demo-credentials.json`, excluido de Git. Repita este paso después de cada `db reset`. Nunca ejecute el seed en producción.

Las cuentas de quiosco usan la pestaña Administrador. Cada empleado debe entrar a su sesión y aceptar los dos documentos antes de marcar, también si usará PIN en el quiosco.

## Pruebas

```powershell
npm test
npm run build
npm run check:edge
npm run test:e2e
```

Deno está incluido como dependencia de desarrollo. Playwright usa Edge instalado; cambie el canal o instale Chromium si usa otro sistema. El servidor de pruebas configura credenciales ficticias y simula Supabase; nunca apunta a producción.

Con Supabase local iniciado:

```powershell
psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/tests/database.sql
```

Alternativamente, sin Docker, `npm run test:sql` crea una base efímera en un clúster exclusivo de `.local/pg-test`, puerto 55439, y la elimina al terminar. Usa PostgreSQL 17 de `C:/Program Files/PostgreSQL/17/bin`. En otros equipos configure `PG_BIN` y opcionalmente `PG_TEST_PORT`. No se conecta a bases ni servicios existentes. El clúster de pruebas usa confianza local y solo escucha en 127.0.0.1; no lo exponga a una red. En entornos restringidos se requiere permiso para conectar a localhost. El proceso se detiene en `finally`.

## Primera empresa en producción

Después de aplicar migraciones, use `scripts/bootstrap.mjs` desde una terminal privada. Defina variables de entorno `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORG_NAME`, `ORG_SLUG`, `OWNER_EMAIL`, `OWNER_NAME` y `OWNER_PASSWORD` (12 o más caracteres). Ejecute `node scripts/bootstrap.mjs`. Nunca use prefijo `VITE_` para esas credenciales. Limpie las variables al terminar. No publique contraseñas ni service role en repositorios o logs.

El script crea la organización, secreto QR, propietario, documentos placeholder y auditoría. No necesita cambios manuales de esquema. Publique los textos revisados antes del uso real. Si el proceso falla después de crear la cuenta propietaria, inspeccione el error y complete los documentos desde Configuración; no borre registros para volver a empezar.

## Despliegue

La aplicación está publicada en https://qrono.pages.dev. Consulta `docs/DESPLIEGUE.md` para actualizarla.

Pages se publica directamente con Wrangler; los pushes a GitHub no despliegan automáticamente. Con las variables públicas de compilación en `.env.production.local` (ignorado por Git) y la sesión Cloudflare autorizada:

```powershell
npm run deploy:pages
```

La configuración remota mínima de Auth vive en `deploy/supabase/config.toml`. Usa `npx supabase config diff --workdir deploy --remote` antes de aplicar cambios. No subas la configuración local con URLs localhost a producción. No ejecutes seed ni db reset en el servidor.

La CSP permite conexiones a `*.supabase.co`. Para un dominio personalizado de Supabase, añade exactamente ese origen a `connect-src`. Vite no aplica `_headers` durante desarrollo.

## Quiosco en tablet

En Personas, agregue un quiosco con correo y contraseña de al menos 12 caracteres. Ingrese con esa cuenta en la tablet; se abrirá `/quiosco`. Instale la PWA desde el menú del navegador. El manifest incluye el acceso directo Quiosco y la sesión persistente envía a esa ruta al abrir el inicio. Wake Lock funciona solo si el navegador lo permite y la página está visible. Mantenga alimentación y conexión estables. Desactivar la cuenta revoca las siguientes operaciones.

El QR rota por slots de 30 segundos y admite actual/anterior: su validez real está entre 30 y 60 segundos desde la emisión. La hora de las marcas siempre la fija PostgreSQL; el reloj del quiosco usa sincronización del servidor y tiempo monotónico. Sin conexión no se registran ni encolan marcas. Un reintento tras respuesta perdida puede ser rechazado por el intervalo mínimo: consulte el historial antes de reintentar.

## Datos, correcciones y exportaciones

- Las marcas, correcciones, documentos, aceptaciones y auditoría rechazan UPDATE/DELETE/TRUNCATE. Las correcciones no modifican el original. Una inserción administrativa también puede anularse mediante otra corrección.
- Las marcas se serializan por empleado con advisory lock. El hash incluye la hora UTC con seis decimales; `chain_index` permite un orden inequívoco.
- El QR prueba posesión del código temporal; una fotografía compartida dentro de su vigencia sigue siendo utilizable. No acredita presencia física por sí solo.
- El bloqueo de cinco intentos protege la ruta de PIN del quiosco. El login directo usa los controles propios de Supabase Auth. Un PIN de seis dígitos tiene seguridad limitada; vigile sus límites y no comparta cuentas.
- Reportes emparejan por secuencia antes de filtrar y atribuyen las horas al día de entrada. Las semanas parciales y las partes de una semana que cruzan año se indican como informativas. Años sin referencia no inventan un límite.
- La bitácora incluye correcciones por fecha de creación, de la marca agregada o de su objetivo, y conserva el objetivo original cuando hace falta para explicar una corrección. CSV usa BOM y neutraliza fórmulas de Excel. El registro de jornada exporta una fila por turno; puede haber varios el mismo día.
- Los datos de una exportación se obtienen mediante una RPC de lectura en un único snapshot PostgreSQL. El MVP carga el libro completo permitido por RLS en memoria; para historiales grandes conviene pasar agregaciones/exportaciones al servidor.
- La auditoría de exportación registra la solicitud antes de generar el archivo; no demuestra que el usuario haya completado una descarga.
- La cadena detecta alteraciones respecto a los hashes guardados; un propietario de PostgreSQL puede desactivar triggers y recalcularla. No existe ancla externa ni certificación de inalterabilidad absoluta.

## Coste y límites a vigilar

Está diseñado para planes gratuitos, sin garantía de disponibilidad ni gratuidad perpetua. Consulte los [precios de Supabase](https://supabase.com/pricing) y los [límites de Cloudflare Pages](https://developers.cloudflare.com/pages/platform/limits/) antes del despliegue. La consulta del 14/11/2026 indicaba 500 MB de base de datos, 50,000 usuarios activos mensuales y pausa después de una semana de inactividad para Supabase Free. Vigile invocaciones Edge, transferencia, crecimiento de auditoría/intentos y límites de Auth; cada quiosco activo genera aproximadamente una petición QR cada 25–30 segundos. Apague/cierre quioscos fuera de horario si no se utilizan. Planifique copias de seguridad y restauración verificadas fuera del presupuesto de infraestructura del MVP.

Las dependencias están fijadas por lockfile. Se actualizaron `glob`/`minimatch` mediante overrides para retirar alertas moderadas; el último audit dejó cuatro alertas bajas transitivas de herramientas de construcción. No se aplicó un downgrade automático incompatible. Revise `npm audit` y vuelva a probar el build al actualizar.

## Pendiente de lineamientos STPS

El [decreto publicado en el DOF](https://dof.gob.mx/nota_detalle_popup.php?codigo=5786537) es una referencia de contexto; esta aplicación no certifica cumplimiento jurídico. Antes de usarla en una empresa, el responsable debe verificar disposiciones vigentes, aplicabilidad y textos con asesoría jurídica.

Los textos iniciales llevan **REVISAR CON ABOGADO**. Complete responsable, finalidades, conservación, transferencias, derechos y acuerdo de uso. Los puntos preparados para ajustes son:

- Formato exigido: `src/lib/exports.ts` y exportaciones del servidor si se requieren firmas o formatos nuevos.
- Retención, respaldo y eliminación conforme a obligaciones: migraciones y procedimientos operativos. No existe purga automática.
- Identificación permitida: Edge Functions, Auth y pantallas QR/PIN; no hay biometría ni ubicación.
- Evidencia de aceptación y versionado: `policy_documents`, `policy_acceptances` y sus RPC.
- Límites informativos por año: catálogo `weekly_limits`, actualizable mediante migraciones.

## Pendientes de validación real

Supabase Auth/PostgREST/Edge desplegados, recuperación de cuenta administrativa (fuera del MVP), cámara física en iOS/Android, instalación y actualizaciones PWA, Wake Lock y cabeceras de hosting. No se ha desplegado ni creado una cuenta externa. No use datos personales reales hasta completar esos controles y reemplazar los documentos placeholder.
