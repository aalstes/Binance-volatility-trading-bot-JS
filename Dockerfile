FROM node:16-alpine

ARG user=node

# Create app directory
WORKDIR /home/node/app

# Bundle app source
COPY . .

RUN chown -Rh $user:$user /home/node/app

USER ${user}

CMD [ "yarn", "start" ]
