# ROL Y CONTEXTO

Eres un ingeniero de software senior full-stack. Vas a construir el MVP de un sistema de registro electrónico de entrada y salida ("checador") para pequeñas empresas en México (menos de 50 empleados por empresa). Debe ayudar a cumplir la obligación de registro electrónico de jornada de la Ley Federal del Trabajo (art. 132 fr. XXXIV) que será exigible desde el 1 de enero de 2027. La STPS aún debe publicar lineamientos, así que el diseño debe ser modular y fácil de ajustar. No uses biometría. Todo el texto de la interfaz va en español (es-MX).

Restricción central: COSTO CERO de infraestructura (planes gratuitos) y la menor complejidad posible. Prefiere soluciones simples y mantenibles sobre soluciones sofisticadas.

Antes de escribir código: muéstrame un plan breve (árbol de archivos, decisiones técnicas y supuestos). Después implementa por fases (sección 13), verificando que compile y pasen las pruebas al terminar cada una.

# 1. ALCANCE DEL MVP

Incluye:
1. PWA con login de empleados y administradores.
2. Check-in/out por QR dinámico: una pantalla "quiosco" en el centro de trabajo muestra un QR que cambia cada 30 s; el empleado lo escanea con su celular (ya con sesión iniciada).
3. Plan B en el quiosco: formulario con número de empleado + PIN de 6 dígitos para quien no tenga celular o datos.
4. Panel de administración: empleados, quioscos, consulta de registros, correcciones con motivo, reportes y exportación (CSV y PDF).
5. Vista del empleado: su estado actual, comprobante de cada marca e historial propio.
6. Aviso de privacidad y acuerdo de uso del registro electrónico, con aceptación registrada.

Fuera de alcance (NO implementar, solo dejar el diseño abierto): biometría, NFC, geolocalización, cola offline de marcas, envío de correos, nómina, cálculo legal de tiempo extra, multi-sucursal avanzado.

# 2. STACK Y RESTRICCIONES

- Frontend: Vite + React + TypeScript, mobile-first, React Router, Tailwind CSS. PWA con vite-plugin-pwa (instalable, caché del shell).
- Backend: Supabase (Postgres, Auth, Row Level Security, Edge Functions en TypeScript/Deno). Sin servidor propio.
- Hosting del frontend: Cloudflare Pages (o Netlify), sitio estático.
- Librerías sugeridas: qrcode (generar QR), html5-qrcode (escáner dentro de la PWA), zod (validación), jsPDF + jspdf-autotable (PDF), date-fns + date-fns-tz (zonas horarias), vitest (pruebas).
- Migraciones SQL versionadas con Supabase CLI en /supabase/migrations. Nada de cambios manuales en el dashboard.
- Ningún secreto en el frontend. Solo se expone la anon key. La service role key y el secreto del QR viven únicamente en Edge Functions.

# 3. MODELO DE DATOS (Postgres)

Multi-empresa desde el inicio: toda tabla lleva org_id y se aísla con RLS.

- organizations: id, name, slug (único, es el "código de empresa"), timezone (default 'America/Mexico_City'), week_starts_on (default 1 = lunes), min_interval_seconds (default 60), qr_secret (aleatorio, 32 bytes; NUNCA legible por clientes), created_at.
- members: user_id (PK, FK a auth.users), org_id, role ('owner' | 'admin' | 'employee' | 'kiosk'), employee_number (texto, nulo para kiosk/admin sin número), full_name, active (bool), created_at, deactivated_at. Único (org_id, employee_number). Baja lógica, nunca borrar.
- time_events (SOLO INSERCIÓN): id uuid, org_id, member_id, event_type ('in' | 'out'), occurred_at timestamptz (la fija el servidor con now(); el cliente no puede enviarla), method ('qr' | 'kiosk_pin'), kiosk_id (member del kiosk, nulo si method='qr'), prev_hash, hash, created_at.
- event_corrections (SOLO INSERCIÓN): id, org_id, member_id (empleado afectado), kind ('void' | 'insert'), target_event_id (si void), event_type y occurred_at (si insert), reason (obligatorio, mínimo 10 caracteres), created_by, created_at.
- pin_attempts: id, org_id, employee_number, kiosk_id, success (bool), attempted_at.
- policy_documents: id, org_id, kind ('aviso_privacidad' | 'acuerdo_registro'), version, body_markdown, created_at. policy_acceptances: id, member_id, document_id, accepted_at, user_agent.
- audit_log: id, org_id, actor_id, action, entity, entity_id, details jsonb, created_at (también solo inserción).
- weekly_limits: year, hours. Seed: 2026→48, 2027→46, 2028→44, 2029→42, 2030→40.

Reglas a nivel base de datos:
- Triggers que RECHAZAN cualquier UPDATE o DELETE en time_events, event_corrections y audit_log (incluso para service role). REVOKE UPDATE/DELETE además.
- Cadena de hash por empleado: un trigger BEFORE INSERT en time_events calcula prev_hash (hash del evento anterior del mismo member_id, o 'GENESIS') y hash = sha256(prev_hash || id || org_id || member_id || event_type || occurred_at en ISO UTC || method). Usa pg_advisory_xact_lock por member_id para evitar condiciones de carrera. Crea la función verify_hash_chain(member_id) que devuelve si la cadena es íntegra y el primer evento inconsistente.
- Vista v_effective_events (security_invoker): eventos no anulados por una corrección 'void' + las correcciones 'insert', con columnas: member_id, event_type, occurred_at, source ('original' | 'correccion'), event_id/correction_id.
- RLS: el empleado solo lee sus propios time_events, correcciones y vista efectiva; admin/owner leen todo de su org; ningún rol de cliente puede INSERT/UPDATE/DELETE en time_events (solo Edge Functions con service role). organizations.qr_secret no debe ser seleccionable por clientes (usa una tabla separada org_secrets sin políticas, o column privileges).

# 4. REGLAS DE NEGOCIO CRÍTICAS

1. La hora SIEMPRE es la del servidor. Nunca confíes en la hora del dispositivo.
2. El tipo de marca (entrada/salida) lo decide el servidor alternando según el último evento efectivo del empleado. Si no hay eventos previos, es 'in'.
3. Anti doble toque: si la última marca del empleado fue hace menos de min_interval_seconds, rechazar con mensaje claro (no insertar).
4. Registros inmutables. Un error se corrige solo con event_corrections (void o insert) con motivo obligatorio, y queda en audit_log. Las correcciones se muestran siempre marcadas como "corregido" en historial, reportes y exportaciones.
5. Turnos que cruzan medianoche: se empareja por secuencia (entrada→salida), no por fecha; las horas se atribuyen al día de la entrada, calculado en la zona horaria de la organización.
6. Entrada sin salida (o salida sin entrada previa) se marca como "incompleto" y se muestra destacado en el panel.
7. Empleados inactivos no pueden marcar, pero su historial se conserva y se puede exportar.
8. El reporte semanal compara horas trabajadas contra weekly_limits del año correspondiente, solo como INFORMACIÓN. Rotularlo así; no calcular tiempo extra legal.
9. Todo timestamp se guarda en UTC y se muestra en la zona horaria de la organización.

# 5. EDGE FUNCTIONS (contratos)

Todas validan entrada con zod, devuelven JSON con códigos HTTP correctos y mensajes en español, y manejan CORS solo para el dominio de la app (variable de entorno).

A) qr-token — requiere JWT de un member con role='kiosk' activo.
 Devuelve {token, expires_at, server_time, slot_seconds}.
 Token = `${org_id}.${slot}.${firma}`, donde slot = floor(unix_seconds / 30) y firma = primeros 16 caracteres base64url de HMAC-SHA256(qr_secret, `${org_id}.${slot}`).
 El QR codifica `${APP_URL}/c?t=${token}`.

B) checkin — requiere JWT.
 Caso 1: {method:'qr', token, dry_run?}. El llamante debe ser employee activo. Validar que el org_id del token coincida con el del empleado, que la firma sea correcta (comparación en tiempo constante) y que el slot sea el actual o el inmediato anterior. Con dry_run=true devuelve solo el tipo propuesto (entrada/salida) para la pantalla de confirmación, sin insertar.
 Caso 2: {method:'kiosk_pin', employee_number, pin}. El llamante debe ser un kiosk activo. Buscar al empleado en la misma org. Bloqueo: si hay 5 intentos fallidos en los últimos 15 minutos para ese número de empleado, responder 429 sin verificar el PIN. Verificar el PIN autenticando contra Supabase Auth con un cliente anon efímero (signInWithPassword con el email sintético, sin persistir sesión). Registrar cada intento en pin_attempts. Mensaje de error genérico ("Número o PIN incorrectos") para no revelar si el número existe.
 En ambos casos: aplicar reglas 2 y 3, insertar con service role, devolver {event_id, event_type, occurred_at, employee_name, folio} donde folio son 8 caracteres derivados del hash del evento.

C) admin-members — requiere JWT con role admin u owner. Acciones: create_employee {employee_number, full_name, pin}, update {full_name, active}, reset_pin {pin}, create_kiosk {name, email, password}, create_admin {email, password, full_name}. Los empleados se crean con auth.admin.createUser con email sintético `${org_slug}.${employee_number}@empleados.checador.app` (email_confirm=true) y el PIN de 6 dígitos como contraseña. Configurar la longitud mínima de contraseña en 6. Cada acción se registra en audit_log. Un admin no puede asignarse rol owner.

D) Funciones SQL (RPC, security definer, verificando rol del llamante): create_correction(...) para el panel y verify_hash_chain(member_id).

# 6. SEGURIDAD

- RLS activado en todas las tablas; escribir pruebas que demuestren que un empleado NO puede leer datos de otro empleado ni de otra organización.
- Validar siempre en servidor: el cliente nunca decide hora, tipo de evento ni org_id.
- PIN: exactamente 6 dígitos, nunca se guarda ni se registra en logs en texto plano fuera de Supabase Auth.
- Los quioscos son cuentas role='kiosk' con sesión persistente; si se revoca (active=false), deja de funcionar.
- Cabeceras de seguridad básicas (CSP razonable, X-Content-Type-Options, Referrer-Policy) vía archivo _headers de Cloudflare Pages.
- No registrar datos personales innecesarios. No recolectar ubicación en este MVP.

# 7. FRONTEND: RUTAS Y PANTALLAS

Estilo: limpio, mobile-first, botones grandes, alto contraste, accesible (etiquetas, foco visible, textos claros). Estados de carga y error en todas las pantallas.

/login — Pestañas "Empleado" y "Administrador". Empleado: código de empresa (se recuerda en el dispositivo) + número de empleado + PIN de 6 dígitos. Administrador: correo + contraseña.
/aceptacion — Primer ingreso de cada empleado: mostrar aviso de privacidad y acuerdo de registro electrónico (versión vigente), casilla de aceptación obligatoria, y guardar en policy_acceptances. No dejar marcar hasta aceptar.
/ (empleado) — Estado actual ("Dentro desde las 09:02" / "Fuera"), botón grande "Escanear QR" (html5-qrcode con cámara trasera; permitir también abrir la URL /c?t=... desde la cámara nativa), y últimas marcas.
/c — Recibe ?t=TOKEN. Si no hay sesión, ir a login y volver aquí. Hace dry_run, muestra "Vas a registrar ENTRADA / SALIDA" con botón Confirmar, y al confirmar muestra el comprobante (tipo, fecha y hora en zona de la org, folio). Maneja token vencido con mensaje claro ("El código expiró, escanea de nuevo").
/historial — Historial propio (últimos 60 días) con marcas originales y correcciones identificadas, y folio de cada marca.
/quiosco (solo role kiosk) — Pantalla completa: reloj grande con hora del servidor (sincronizada con server_time), QR grande que se renueva cada ~25 s con anillo de cuenta regresiva, y debajo un panel "¿Sin celular? Usa tu número y PIN" con teclado numérico en pantalla, grande y táctil. Tras una marca exitosa por PIN, mostrar 5 segundos "Hola {nombre} — ENTRADA 09:02" y limpiar el formulario. Si falla la conexión, mostrar aviso visible de "Sin conexión: no se pueden registrar marcas" (no hay cola offline). Evitar que la pantalla se apague (Screen Wake Lock API cuando esté disponible).
/admin — Dashboard: quién está dentro ahora, marcas del día, registros incompletos.
/admin/empleados — Alta, edición, baja lógica, reset de PIN. Lista de quioscos y alta de quiosco.
/admin/registros — Tabla con filtros (rango de fechas, empleado, solo incompletos, solo corregidos). Acción "Corregir": anular una marca o agregar una faltante, con motivo obligatorio (mínimo 10 caracteres) y confirmación.
/admin/reportes — Por empleado y periodo: tabla diaria (entrada, salida, horas, estado), total por semana vs límite semanal del año (informativo), y exportaciones. Botón "Verificar integridad" que ejecuta verify_hash_chain y muestra el resultado.
/admin/configuracion — Zona horaria, inicio de semana, intervalo mínimo, y edición de aviso de privacidad y acuerdo (crea nueva versión, no sobrescribe).

# 8. REPORTES Y EXPORTACIÓN

- CSV (UTF-8 con BOM para que Excel lo abra bien, separador coma): columnas: empresa, número de empleado, nombre, fecha, tipo, fecha_hora_local, fecha_hora_utc, método, origen (original/corrección), folio, motivo_corrección, hash.
- Dos exportaciones: (a) "Registro de jornada" por empleado y periodo con entrada/salida/horas por día, (b) "Bitácora completa" con todos los eventos crudos y todas las correcciones, pensada para entregar a una autoridad.
- PDF con jsPDF + autotable: encabezado con empresa, periodo, fecha de generación, tabla diaria y totales; pie con aviso de que la información proviene del registro electrónico de la empresa.
- Toda exportación se registra en audit_log (quién, cuándo, qué filtros).

# 9. PWA

- manifest completo (nombre, iconos 192/512 y maskable, theme_color, display standalone, start_url).
- Service worker solo para caché del shell. Las marcas NO se encolan offline, porque la hora debe ser del servidor.
- El quiosco debe poder instalarse como PWA en una tablet y abrir directo en /quiosco.

# 10. LEGAL Y PRIVACIDAD

- Incluir textos PLACEHOLDER claros para el aviso de privacidad y el acuerdo de registro electrónico, marcados como "REVISAR CON ABOGADO". Los textos reales los provee el usuario.
- Datos que se recaban: nombre, número de empleado, marcas con hora y método. Indicar esto en el aviso placeholder.
- Dejar en README una sección "Pendiente de lineamientos STPS" que liste dónde habría que ajustar cosas si los lineamientos cambian requisitos (formato de exportación, retención de datos, método de identificación).

# 11. ESTRUCTURA DEL PROYECTO

/supabase/migrations (SQL), /supabase/functions/{qr-token,checkin,admin-members}, /supabase/seed.sql (una org demo con 1 owner, 1 kiosk y 5 empleados de prueba), /src (components, pages, lib, hooks), /tests, README.md.

Incluir .env.example con: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL (frontend) y APP_URL, SUPABASE_SERVICE_ROLE_KEY (solo funciones).

README en español con: requisitos, cómo correr local (supabase start, supabase db reset, functions serve, npm run dev), cómo desplegar (crear proyecto Supabase, supabase link, supabase db push, supabase functions deploy, variables en Cloudflare Pages), cómo crear la primera empresa y su owner, cómo dar de alta un quiosco e instalarlo en una tablet, y límites a vigilar del plan gratuito.

# 12. PRUEBAS (Vitest + pruebas SQL)

- Token QR: válido en el slot actual, válido en el anterior, inválido en el de hace 2 slots, inválido con firma alterada, inválido con org distinta.
- Lógica de alternancia entrada/salida y anti doble toque.
- Emparejamiento de turnos: día normal, turno que cruza medianoche, entrada sin salida, salida sin entrada.
- Cálculo de horas semanales y comparación con el límite del año.
- SQL: UPDATE/DELETE en time_events fallan; la cadena de hash detecta un evento alterado; RLS impide acceso cruzado entre empleados y entre organizaciones.
- Bloqueo tras 5 PIN fallidos.

# 13. FORMA DE TRABAJO Y ENTREGABLES

Fases (verifica que compile y pase pruebas al cierre de cada una):
 Fase 1: migraciones, triggers, hash chain, RLS, seed y pruebas SQL.
 Fase 2: Edge Functions y sus pruebas.
 Fase 3: login, aceptación de políticas, flujo del empleado (/ , /c, /historial).
 Fase 4: quiosco (QR dinámico + plan B con PIN).
 Fase 5: panel admin, correcciones, reportes y exportaciones.
 Fase 6: PWA, cabeceras de seguridad, README y pulido.

Criterios de aceptación:
 - Un empleado escanea el QR del quiosco, confirma y recibe comprobante con folio; el registro aparece en su historial y en el panel.
 - Un QR de hace más de ~60 s es rechazado.
 - Un empleado sin celular marca con número + PIN en el quiosco; tras 5 PIN fallidos queda bloqueado 15 minutos.
 - Ningún usuario puede editar ni borrar un registro; las correcciones exigen motivo y quedan visibles y auditadas.
 - El admin exporta CSV y PDF correctos de un periodo, y la verificación de integridad pasa en datos sanos y falla si se altera un evento directamente en la base.
 - Un empleado no puede ver datos de otro, ni de otra empresa.
 - La app se instala como PWA y todo corre en planes gratuitos.

Cuando haya ambigüedad, elige la opción más simple, documenta el supuesto en el README y sigue adelante en lugar de detenerte a preguntar. Al final, resume qué quedó hecho, qué quedó pendiente y los riesgos conocidos.