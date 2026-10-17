# Clínica — Docker Setup

## ¿Qué es esto?

Tu proyecto de clínica está empaquetado en una **imagen Docker**. Tu compañero solo necesita ejecutar un comando para tenerlo corriendo sin instalar nada.

---

## Cómo tu compañero lo usa

### 1. Descarga la imagen desde Docker Hub (cuando la subas)

```bash
docker pull tu-usuario/clinica:latest
```

### 2. Ejecuta el contenedor

```bash
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos --name clinica tu-usuario/clinica:latest
```

### 3. Abre en el navegador

```
http://localhost:8080
```

---

## Qué incluye el contenedor

✅ Servidor Node.js (Express) que sirve el sitio y la API
✅ Base de datos SQLite, guardada en el volumen `clinica-datos` para no perder los datos al reiniciar
✅ Todos tus archivos HTML, CSS, JS
✅ Estructura completa de la clínica

---

## ¿Cómo compartir la imagen?

### Opción 1: Docker Hub (recomendado)

```bash
# Inicia sesión
docker login

# Etiqueta tu imagen
docker tag clinica:latest tu-usuario/clinica:latest

# Sube la imagen
docker push tu-usuario/clinica:latest
```

Tu compañero luego hace:

```bash
docker pull tu-usuario/clinica:latest
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos tu-usuario/clinica:latest
```

### Opción 2: Guardar y compartir como archivo

```bash
# Guarda la imagen en un archivo
docker save clinica:latest -o clinica.tar

# Comparte clinica.tar con tu compañero
# Tu compañero la carga con:
docker load -i clinica.tar
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos clinica:latest
```

### Opción 3: Compartir el Dockerfile + código

Tu compañero clona tu GitHub y construye localmente:

```bash
git clone https://github.com/fox123abc/Clinica
cd Clinica
docker build -t clinica:latest .
docker run -d -p 8080:3000 -v clinica-datos:/app/servidor/datos clinica:latest
```

---

## Archivos Docker en tu proyecto

- **Dockerfile**: receta para construir la imagen
- **.dockerignore**: archivos a ignorar (Git, node_modules, etc.)

---

## Útiles

### Ver logs

```bash
docker logs clinica-app
```

### Detener el contenedor

```bash
docker stop clinica-app
```

### Eliminar el contenedor

```bash
docker rm clinica-app
```

### Ver imágenes locales

```bash
docker images
```
