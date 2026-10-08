# Dockerfile
FROM node:22-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app
ENV NODE_ENV=production

ENV PORT=3000
ENV SHOPIFY_APP_URL=http://0.0.0.0:3000

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
RUN npm remove @shopify/cli

COPY . .

RUN npm run build

CMD ["npm", "run", "docker-start"]
