FROM node:24-alpine

WORKDIR /app

# Dependencias primero (aprovecha la caché de Docker)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código del sitio y del servidor
COPY . .

ENV PUERTO=3000
# La base de datos SQLite se guarda aquí; montar un volumen para conservarla
VOLUME /app/servidor/datos

EXPOSE 3000

CMD ["node", "servidor/servidor.js"]
