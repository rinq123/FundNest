FROM node:20-alpine

WORKDIR /workspace

COPY package.json ./
COPY apps/api/package.json ./apps/api/

RUN npm install

COPY . .

WORKDIR /workspace/apps/api

EXPOSE 3000

CMD ["npm", "run", "start"]
