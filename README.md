# AuraPrices

**Explorá videojuegos, compará precios entre tiendas y seguí las ofertas de tus favoritos.**

AuraPrices es un proyecto universitario de práctica profesional. Combina una interfaz en React, una API en Express y una base PostgreSQL para aprender a desarrollar una aplicación web completa, desde la búsqueda de juegos hasta el almacenamiento de usuarios e historial de precios.

## Funcionalidades

- Búsqueda de videojuegos y exploración de ofertas, juegos populares y juegos gratuitos.
- Filtros por tienda, precio y descuento; rankings de popularidad, listas de deseados y colecciones de usuarios de IsThereAnyDeal.
- Comparación de precios entre tiendas y enlaces para consultar sus ofertas.
- Ficha del juego con descripción e imágenes cuando los proveedores las ofrecen.
- Registro e inicio de sesión con contraseñas protegidas mediante bcrypt y autenticación JWT.
- Favoritos personales y selección múltiple para eliminarlos.
- Alertas por precio objetivo y notificaciones dentro de la aplicación.
- Historial de precios registrado por juego y tienda.
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

Los precios se consultan para la región US y el historial se guarda en **USD**. La conversión a ARS se realiza en el navegador mediante una cotización externa: es una referencia y puede diferir del importe final de compra, impuestos o condiciones regionales de cada tienda.

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

Los modelos principales son `User`, `Game`, `Store`, `Favorite`, `PriceAlert`, `Notification` y `PriceRecord`. Un favorito relaciona un usuario con un juego; un registro de precio relaciona un juego con una tienda, un importe y una fecha.

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

El historial se construye con las consultas de precios y las revisiones de juegos guardados como favoritos. Para cada tienda se guarda un primer precio válido en USD y luego un nuevo registro cuando cambia el importe. No se agrega un registro idéntico por cada consulta.

`Favorite` y `PriceRecord` cumplen funciones distintas: el primero indica qué sigue cada usuario; el segundo conserva observaciones de precios compartidas por juego y tienda. Guardar un favorito no copia una fila completa a la tabla del historial.

Con `ENABLE_PRICE_CHECKS=true`, Express revisa los favoritos al iniciar y cada 30 minutos para registrar cambios y generar notificaciones dentro de la aplicación. No se envían correos ni se ejecuta un cron externo. Si el backend se detiene o el proveedor de alojamiento lo suspende, las revisiones también se interrumpen. No se recuperan precios anteriores a la puesta en marcha del proyecto.

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
