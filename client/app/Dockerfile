# ======================== STAGE 1: BUILD ========================
FROM node:20-alpine AS builder
WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_SOCKET_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

# Copy package files from the app subdirectory
COPY app/package*.json ./
RUN npm install

# Copy the rest of the app source
COPY app/ ./

# Copy .env from the build context (client/.env)
COPY .env ./

RUN npm run build

# ======================== STAGE 2: SERVE ========================
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
EXPOSE 80