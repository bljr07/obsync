FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY prisma ./prisma
COPY src ./src

RUN npm run db:generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:docker"]
