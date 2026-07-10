FROM openresty/openresty:alpine-fat

# Copy the custom nginx config
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf

# Copy the maintenance page to the default static folder
COPY maintenance.html /usr/share/nginx/html/maintenance.html

EXPOSE 80