FROM nginx:latest

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Maintenance pages – ensure all exist in the build context
COPY maintenance-api.html /usr/share/nginx/html/
COPY maintenance-server.html /usr/share/nginx/html/
COPY maintenance-client.html /usr/share/nginx/html/
COPY maintenance-telemetry-client.html /usr/share/nginx/html/
COPY maintenance-telemetry-server.html /usr/share/nginx/html/   

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s CMD nginx -t || exit 1


