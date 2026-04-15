FROM node:20-alpine

WORKDIR /app

# Install dependencies for sharp (native image processing)
RUN apk add --no-cache python3 make g++ vips-dev

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

EXPOSE 4000

CMD ["node", "src/app.js"]
