FROM ubuntu:16.04 
RUN apt-get update
RUN apt-get install -y curl 
RUN curl -sL https://deb.nodesource.com/setup_6.x | bash -
RUN apt-get install -y nodejs python-setuptools python-pip  
RUN pip install -U platformio
WORKDIR /usr/src/avr-pizza-service
COPY package.json .
RUN npm install
COPY . .

EXPOSE 80
ENV PORT=80
ENTRYPOINT ["node", "server.js"]
