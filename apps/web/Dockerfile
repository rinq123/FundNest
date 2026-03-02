FROM node:20-alpine

WORKDIR /workspace

COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

RUN npm install

COPY . .

WORKDIR /workspace/apps/web

EXPOSE 5173

CMD ["npm", "run", "dev"]
