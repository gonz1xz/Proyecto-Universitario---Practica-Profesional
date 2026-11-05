# AuraPrices

**Explorá videojuegos, compará precios entre tiendas y seguí las ofertas de tus favoritos.**

AuraPrices es un proyecto universitario de práctica profesional. Combina una interfaz en React, una API en Express y una base PostgreSQL para aprender a desarrollar una aplicación web completa, desde la búsqueda de juegos hasta el almacenamiento de usuarios e historial de precios.

## Funcionalidades

- Búsqueda de videojuegos y exploración de ofertas, juegos populares y juegos gratuitos.
- Filtros por tienda, precio y descuento; rankings de popularidad, listas de deseados y colecciones de usuarios de IsThereAnyDeal.
- Comparación de precios entre tiendas y enlaces para consultar sus ofertas.
- Ficha del juego con descripción e imágenes cuando los proveedores las ofrecen.
- Registro e inicio de sesión con bcrypt, JWT y renovación automática mediante refresh token.
- Favoritos personales y selección múltiple para eliminarlos.
- Alertas por precio objetivo, buzón interno y avisos opcionales por mail con correo verificado.
- Historial de ITAD de los últimos tres meses, con gráfico por tienda y tabla de cambios.
- Visualización en USD o ARS y temas claro y oscuro.

Los rankings corresponden a los datos de IsThereAnyDeal: no representan un ranking global de ventas.

## Tecnologías

| Parte | Tecnologías |
| --- | --- |
| Interfaz | React 19, React Router 7, Vite 7, Tailwind CSS 4 y Lucide |
| API | Node.js 24 y Express 5 |
| Base de datos | PostgreSQL y Prisma 6.19.3 |
| Autenticación | JWT y bcrypt |
| Datos externos | IsThereAnyDeal, Steam y ExchangeRate-API |
| Despliegue preparado | Vercel para React, Render para Express y Neon para PostgreSQL |

## Cómo funciona

```text
Navegador (React)
       |
       | HTTP /api
       v
Backend (Express) ----> IsThereAnyDeal / Steam
       |
       | Prisma
       v
PostgreSQL
```

El frontend presenta los juegos y envía solicitudes al backend. Express valida las solicitudes, consulta los proveedores y utiliza Prisma para leer o guardar datos. La clave de IsThereAnyDeal y las credenciales de PostgreSQL permanecen en el backend.

Los precios y el historial se consultan para la región US en **USD**. La conversión de precios actuales a ARS se realiza en el navegador mediante una cotización externa: es una referencia y puede diferir del importe final de compra, impuestos o condiciones regionales de cada tienda. El historial muestra los USD originales.

### Sesiones y renovación

El access token dura 15 minutos y se guarda en memoria. El frontend lo renueva un minuto antes de vencer; también comprueba la sesión al regresar a una pestaña suspendida y puede reintentar una consulta protegida una vez después de un 401.

El refresh token es aleatorio, se guarda en una cookie HttpOnly y se reemplaza en cada renovación. PostgreSQL guarda solamente su hash en `RefreshSession`. Sin «Recordarme», la cookie es de sesión y el permiso de renovación dura como máximo 1 día desde el login. Con «Recordarme», la cookie persiste hasta 30 días desde el login. Renovar no extiende esos límites. El navegador puede restaurar cookies de sesión al recuperar una sesión anterior.

`POST /api/auth/login`, `/refresh` y `/logout` requieren `X-Aura-Request: 1`; las solicitudes del frontend a autenticación incluyen `credentials: 'include'`. El cierre de sesión elimina el registro de renovación y la cookie. Un access token ya emitido conserva su validez hasta vencer, como máximo 15 minutos; el navegador descarta su copia al salir.

Después de actualizar desde la versión anterior, iniciá sesión otra vez para obtener la cookie. Para otros entornos, ejecutá `npm run build` y `npm run db:deploy` en backend antes de iniciar la versión nueva. No hace falta un secreto JWT adicional ni nuevas dependencias.

En desarrollo se usa `SameSite=Lax`; en producción, `SameSite=None; Secure` para permitir frontend y API en sitios distintos. Debe haber HTTPS y un `CORS_ORIGIN` exacto. Algunos navegadores bloquean cookies de terceros incluso con esa configuración: para esos casos se necesita servir la API bajo el mismo sitio mediante dominios propios o un proxy. Esa configuración de hosting queda pendiente de validar al desplegar. Véase [MDN sobre CORS y cookies de terceros](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS).

## Estructura del repositorio

```text
backend/
  prisma/
    schema.prisma       # Modelos de la base
    migrations/         # Cambios versionados de su estructura
  src/
    routes/             # Endpoints de la API
    middlewares/        # Autenticación y validaciones
    services/           # Precios, historial y notificaciones
    app.js              # Express, CORS y rutas
    server.js           # Puerto e inicio del servidor
  test/                 # Pruebas del backend y servicios
  .env.example
frontend/
  src/
    components/         # Tarjetas, ventanas y elementos compartidos
    context/            # Estado compartido de la aplicación
    pages/              # Pantallas
    services/           # Consultas a la API y utilidades
  .env.example
  vercel.json
```

Los modelos utilizados son `User`, `RefreshSession`, `Game`, `Favorite`, `PriceAlert` y `Notification`. Un favorito relaciona un usuario con un juego. El historial se obtiene de ITAD y no se almacena en una tabla propia. `Store` se conserva en el esquema, aunque actualmente no se utiliza para guardar precios.

## Ejecutar en desarrollo

### Requisitos

- Node.js **24.x** y npm.
- PostgreSQL disponible y una base de desarrollo creada.
- Una clave de API de [IsThereAnyDeal](https://isthereanydeal.com/) para consultar juegos y precios.
- Git para clonar el repositorio.

### 1. Descargar el proyecto

```powershell
git clone https://github.com/gonz1xz/Proyecto-Universitario---Practica-Profesional.git
cd Proyecto-Universitario---Practica-Profesional
```

### 2. Configurar el backend

En una terminal de PowerShell:

```powershell
cd backend
Copy-Item .env.example .env
```

Completá `backend/.env` con tus valores privados antes de continuar:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | URL de conexión a tu PostgreSQL de desarrollo |
| `DIRECT_URL` | Conexión directa para migraciones; opcional en desarrollo local |
| `ACCESS_TOKEN_SECRET` | Secreto privado para firmar los tokens de sesión |
| `ITAD_API_KEY` | Clave privada de IsThereAnyDeal |
| `PORT` | Puerto de Express; por defecto `3001` |
| `NODE_ENV` | `development` para trabajar localmente |
| `CORS_ORIGIN` | Orígenes permitidos, separados por comas; el ejemplo incluye Vite local |
| `ENABLE_PRICE_CHECKS` | `true` para habilitar la revisión periódica; `false` para desactivarla |
| `BREVO_API_KEY` | Opcional: clave privada de Brevo para enviar confirmaciones y avisos |
| `EMAIL_FROM` | Opcional: remitente autorizado por Brevo, por ejemplo `AuraPrices <avisos@tu-dominio>` |
| `FRONTEND_URL` | Origen del frontend para los enlaces de correo; HTTPS en producción |

Podés generar un secreto para `ACCESS_TOKEN_SECRET` en tu terminal:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Guardá el resultado únicamente en tu configuración privada. No publiques `.env`, claves ni URLs de conexión con credenciales.

Instalá las dependencias, generá el cliente y aplicá las migraciones:

```powershell
npm ci
npm run build
npm run db:deploy
npm run dev
```

La API estará disponible en `http://localhost:3001/api`. Podés comprobar el proceso abriendo `http://localhost:3001/api/health`: debe devolver `{"status":"ok"}`. Este endpoint no comprueba la conexión a PostgreSQL.

### 3. Configurar el frontend

En otra terminal, desde la raíz del repositorio:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Abrí la dirección que indique Vite, normalmente `http://localhost:5173`. La configuración local usa `VITE_API_URL=/api` y un proxy hacia `VITE_BACKEND_URL=http://localhost:3001`.

Para terminar, presioná **Ctrl+C en ambas terminales**.

## Scripts útiles

Ejecutar cada comando dentro de la carpeta indicada. No hay un script npm en la raíz.

| Carpeta | Comando | Qué hace |
| --- | --- | --- |
| `backend` | `npm run dev` | Inicia Express con recarga al modificar archivos |
| `backend` | `npm run build` | Genera Prisma Client |
| `backend` | `npm run db:validate` | Valida el schema de Prisma |
| `backend` | `npm run db:status` | Consulta el estado de las migraciones |
| `backend` | `npm run db:deploy` | Aplica las migraciones pendientes |
| `backend` | `npm test` | Ejecuta las pruebas |
| `backend` | `npm start` | Inicia Express sin modo de desarrollo |
| `backend` | `npm run start:deploy` | Aplica migraciones e inicia Express |
| `frontend` | `npm run build` | Compila la interfaz en `dist/` |
| `frontend` | `npm run preview` | Sirve el build para una revisión local |

Las pruebas pueden crear y eliminar datos: usá una base local de desarrollo o una base exclusiva de pruebas, nunca la de producción. Si Windows bloquea el motor de Prisma al generar el cliente, detené el backend antes de repetir el comando.

## Historial y notificaciones

El backend consulta `GET /games/history/v2` de ITAD y devuelve los cambios de los últimos tres meses por tienda, en USD y para la región US. Mantiene la clave en el servidor y usa una caché en memoria de 15 minutos y hasta 100 juegos; las consultas simultáneas del mismo juego comparten la solicitud. La interfaz identifica a IsThereAnyDeal como fuente. [Documentación de ITAD](https://docs.isthereanydeal.com/).

Se muestra el menor precio del período consultado, no un mínimo histórico de todos los tiempos. Las ofertas retiradas (`deal=null`) no se convierten en precio cero. Si ITAD falla se informa el error y se permite reintentar. La tabla `PriceRecord` se eliminó mediante una migración nueva que conserva las migraciones anteriores. Esa migración borra las observaciones locales de precios de la base donde se aplique; antes de actualizar una base con datos que quieras conservar, exportá esa tabla.

El gráfico muestra una tienda por vez, conserva los USD originales y permite recorrer observaciones con el mouse o el teclado. Recibe todos los cambios devueltos por ITAD para el período, aunque la tabla esté paginada. La línea une observaciones y no garantiza disponibilidad continua entre ellas.

Con `ENABLE_PRICE_CHECKS=true`, Express revisa los favoritos al iniciar y cada 30 minutos para generar notificaciones. Las alertas comparan precios actuales con los objetivos y no dependen de una tabla de historial. Para recibir mails hay que configurar Brevo, confirmar el correo desde la alerta y activar «Recibir también el aviso por mail» por juego. Solo se envían nuevos avisos de precio objetivo; las ofertas generales continúan en el buzón. El canal mail está desactivado por defecto.

Los avisos por mail quedan pendientes en `Notification`; un procesador intenta enviarlos cada minuto mientras Express esté activo. Conserva el contenido y una clave de idempotencia para los reintentos, con un máximo de cinco intentos, cortando los reintentos a los 25 minutos del primero; no inicia avisos de más de 24 horas. Un envío marcado como enviado significa que el proveedor lo aceptó; no confirma entrega a la bandeja de entrada. Sin configuración de correo, la aplicación y su buzón siguen funcionando.

No hay un cron externo. Si el backend se detiene o el proveedor lo suspende, también se detienen las revisiones de precios y el procesamiento de mails. El historial de ITAD se solicita al abrir su vista. La configuración de Brevo y una entrega real quedaron pendientes por decisión del usuario; no se incluyeron claves en el repositorio.

## Despliegue

El repositorio está preparado para separar los tres servicios. La configuración no implica que ya estén publicados.

| Servicio | Carpeta | Configuración |
| --- | --- | --- |
| Render | `backend` | Build: `npm ci --include=dev && npm run build`; inicio: `npm run start:deploy`; health: `/api/health` |
| Vercel | `frontend` | Preset Vite; instalación, compilación y rutas definidas en `vercel.json` |
| Neon | — | PostgreSQL: conexión pooled en `DATABASE_URL` y directa en `DIRECT_URL` |

En Render configurá `NODE_ENV=production`, las credenciales privadas, `CORS_ORIGIN` con el origen HTTPS exacto de tu frontend y `ENABLE_PRICE_CHECKS`. El servidor escucha en `0.0.0.0` y utiliza el `PORT` asignado por la plataforma.

En Vercel configurá **únicamente la dirección pública de la API** para este enlace:

```text
VITE_API_URL=https://TU-BACKEND.onrender.com/api
```

Reemplazá el dominio de ejemplo por el real. Las variables `VITE_` se incluyen en los archivos públicos del navegador y requieren un nuevo build al cambiarlas. Nunca deben contener secretos ni conexiones de PostgreSQL.

Las migraciones crean la estructura de una base nueva, pero no trasladan los datos locales. Los planes gratuitos pueden suspender servicios o limitar recursos; revisá sus condiciones antes de desplegar. El temporizador actual requiere que Express permanezca ejecutándose.

## Alcance académico

AuraPrices es un proyecto en evolución para practicar frontend, APIs, autenticación, bases relacionales y despliegue. Los precios, imágenes y metadatos dependen de proveedores externos. No procesa pagos ni vende videojuegos: permite explorar ofertas y acceder a las tiendas correspondientes.
