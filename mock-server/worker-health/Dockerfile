FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Run as root to access the Docker socket
USER root

CMD ["node", "index.js"]