FROM node:14-slim


# Install chromium and xvfb.
RUN apt-get update && apt-get install -y chromium xvfb locales
RUN apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget

RUN locale-gen en_US.UTF-8

WORKDIR /home

COPY package.json .
RUN npm install

ADD . .

CMD Xvfb :99 -ac -screen 0 1280x720x16 -nolisten tcp & DISPLAY=:99 node main.js
