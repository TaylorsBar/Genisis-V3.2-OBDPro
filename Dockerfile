# Genesis OS — production static + express static server
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
ARG GEMINI_API_KEY=
ENV GEMINI_API_KEY=$GEMINI_API_KEY
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY server.js ./
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "server.js"]
