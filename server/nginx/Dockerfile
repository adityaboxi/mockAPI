FROM nginx:alpine

# Remove the default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy your custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the maintenance page to the default static folder
COPY maintenance.html /usr/share/nginx/html/maintenance.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]