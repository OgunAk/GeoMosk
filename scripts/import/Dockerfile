# Import aracı: yalnızca Node + pg. Veri dizini çalışma anında ./data olarak bağlanır.
FROM node:24.21.0-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY scripts/import/ scripts/import/
USER node
ENTRYPOINT ["node"]
CMD ["scripts/import/load-osm.mjs"]
