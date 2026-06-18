FROM node:20-alpine

WORKDIR /app

COPY ./backend/package.json ./
COPY ./backend/.npmrc ./
RUN npm install

COPY ./shared /shared
COPY ./backend/tsconfig.json ./
COPY ./backend/src ./src

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/app/src/index.js"]
