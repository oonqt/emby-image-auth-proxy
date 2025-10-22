# docker build -f ./master/Dockerfile -t master-drivemonitor .

FROM node:22-alpine

WORKDIR /usr/src/app/

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["npm", "start"]