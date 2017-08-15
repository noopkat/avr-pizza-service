FROM node:boron
RUN apt-get update && \
    apt-get install -y python-setuptools python-pip \
    && pip install -U platformio

WORKDIR /usr/src/avr-pizza-service
COPY package.json .
RUN npm install
COPY . .

EXPOSE 80
ENV PORT=80

ENTRYPOINT ["node", "server.js"]
