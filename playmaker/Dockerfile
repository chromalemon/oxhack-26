FROM node:24-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4173

COPY package.json ./
COPY README.md ./
COPY index.html styles.css app.js analysis.js server.js ./
COPY model/model.json ./model/model.json

RUN mkdir -p /app/data

EXPOSE 4173
CMD ["npm", "start"]