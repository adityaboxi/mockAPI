# Use the official Nginx base image
FROM nginx:latest

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom domain routing config
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY maintenance.html /usr/share/nginx/html/maintenance.html

# Expose both HTTP (80) and HTTPS (443)
EXPOSE 80 443

# Health check: verify Nginx config is valid (faster and more reliable)
HEALTHCHECK --interval=30s --timeout=3s \
  CMD nginx -t || exit 1