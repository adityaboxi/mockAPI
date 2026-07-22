FROM openresty/openresty:alpine

# Install Perl and curl (required for opm)
RUN apk add --no-cache perl curl

# Install lua-resty-http
RUN opm install ledgetech/lua-resty-http

# Copy your Lua module
COPY log_buffer.lua /usr/local/openresty/lualib/log_buffer.lua

# Copy your nginx config
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf