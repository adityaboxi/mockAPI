FROM nginx:latest

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY maintenance-api.html /usr/share/nginx/html/maintenance-api.html
COPY maintenance-server.html /usr/share/nginx/html/maintenance-server.html
COPY maintenance-client.html /usr/share/nginx/html/maintenance-client.html

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=3s CMD nginx -t || exit 1

