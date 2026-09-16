FROM nginx:alpine

# Copiar archivos del proyecto al servidor web
COPY . /usr/share/nginx/html/

# Copiar configuración personalizada de Nginx (opcional)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ =404; } }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
