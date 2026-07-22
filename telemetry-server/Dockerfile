FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY index.js .
COPY public ./public

EXPOSE 3003

CMD ["node", "index.js"]