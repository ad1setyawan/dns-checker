# Use Node.js Alpine as base image
FROM node:18-alpine

# Install nginx and supervisor
RUN apk add --no-cache nginx supervisor

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --only=production

# Copy application files
COPY server.js .
COPY config/ ./config/
COPY index.html /usr/share/nginx/html/

# Copy deployment configuration files
COPY .deployment/nginx.conf /etc/nginx/conf.d/default.conf
COPY .deployment/supervisord.conf /etc/supervisor/conf.d/dns-venturo.conf

# Expose port 80
EXPOSE 80

# Start supervisor to manage both services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/dns-venturo.conf"]