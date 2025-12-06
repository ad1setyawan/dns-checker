FROM node:18-alpine

# Install Nginx & Supervisor
RUN apk update && \
    apk add --no-cache nginx supervisor

# Set working directory
WORKDIR /app

# Copy Node.js server
COPY server.js /app/server.js
COPY package*.json /app/

# Copy config files
RUN mkdir -p /app/config
COPY config/* /app/config/
COPY .env /app/.env

# Install Node dependencies (jika tidak ada, tetap aman)
RUN npm install || true

# Copy HTML ke Nginx webroot
COPY index.html /usr/share/nginx/html/index.html

# Copy config
COPY .deployment/nginx.conf /etc/nginx/nginx.conf
COPY .deployment/supervisord.conf /etc/supervisord.conf

# Expose ports
EXPOSE 80

# Jalankan supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
