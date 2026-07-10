# Use the official Nginx base image
FROM nginx:latest

# Remove the default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom domain routing config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose both HTTP (80) and HTTPS (443)
EXPOSE 80 443

# Optional: Add a health check to verify Nginx is running
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost/ || exit 1