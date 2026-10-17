# Clínica Altavida — Docker

Con Docker, tu compañero ejecuta el proyecto **exactamente igual que tú**,
sin instalar Node.js ni ninguna base de datos. Solo necesita
[Docker Desktop](https://www.docker.com/products/docker-desktop/) abierto.

---

## Forma recomendada: clonar y levantar con un comando

```bash
git clone -b mi-nueva-funcionalidad https://github.com/fox123abc/Clinica.git
cd Clinica
docker compose up -d --build
```

Abrir en el navegador: **http://localhost:8080**

Iniciar sesión con el usuario de demostración (se crea solo la primera vez):

| Correo | Contraseña |
| --- | --- |
| `paciente@altavida.com` | `Altavida2026` |

> La primera vez tarda uno o dos minutos porque descarga la imagen base de
> Node.js. Las siguientes veces arranca en segundos.

---

## Qué incluye el contenedor

- ✅ Servidor Node.js (Express) que sirve el sitio y la API.
- ✅ Base de datos SQLite con el catálogo de demostración y el usuario de prueba.
- ✅ La base se guarda en el volumen `clinica-datos`: **no se pierde** al
  detener o reiniciar el contenedor.

---

## Comandos útiles

| Para… | Comando |
| --- | --- |
| Levantar (o reconstruir tras un `git pull`) | `docker compose up -d --build` |
| Ver los mensajes del servidor | `docker compose logs -f` |
| Detener | `docker compose down` |
| **Empezar de cero** (borra la base de datos) | `docker compose down -v` y luego `docker compose up -d --build` |
| Copiar la base de datos a tu PC para verla | `docker compose cp clinica:/app/servidor/datos/altavida.db ./altavida-docker.db` |

---

## Otras formas de compartirlo (sin clonar el repositorio)

### Docker Hub

```bash
# Quien publica
docker login
docker tag clinica-altavida:latest tu-usuario/clinica-altavida:latest
docker push tu-usuario/clinica-altavida:latest

# Quien la usa
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos --name clinica-altavida tu-usuario/clinica-altavida:latest
```

### Archivo `.tar`

```bash
# Quien publica
docker save clinica-altavida:latest -o clinica-altavida.tar

# Quien la usa
docker load -i clinica-altavida.tar
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos --name clinica-altavida clinica-altavida:latest
```

---

## Archivos Docker en el proyecto

| Archivo | Para qué |
| --- | --- |
| `Dockerfile` | Receta de la imagen (Node 24, instala dependencias, copia el código). |
| `docker-compose.yml` | Levanta todo con un comando: puerto 8080 y volumen de datos. |
| `.dockerignore` | Excluye `node_modules`, `.git`, la base de datos local y los `.md`. |

---

## Problemas comunes

| Síntoma | Solución |
| --- | --- |
| `failed to connect to the docker API` | Docker Desktop no está abierto. Ábrelo y espera a que diga *Engine running*. |
| `port is already allocated` | El puerto 8080 está ocupado. Cambia `"8080:3000"` por `"8081:3000"` en `docker-compose.yml`. |
| No veo mis últimos cambios | Reconstruye: `docker compose up -d --build`. |
| El usuario de demostración no funciona | La base ya existía de antes con otros datos. Empieza de cero con `docker compose down -v`. |
