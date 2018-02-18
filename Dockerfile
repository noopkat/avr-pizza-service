FROM node:8
MAINTAINER Suz Hinton (noopkat@gmail.com) 

EXPOSE 3000 
ENV PORT=3000
ENV NODE_ENV=production

RUN adduser --system app
RUN mkdir -p /srv/www/avr-pizza
WORKDIR /srv/www/avr-pizza 
COPY . .

RUN chmod +x install.sh && /bin/sh -C install.sh
RUN npm install

USER app
CMD ["node","server.js"]

