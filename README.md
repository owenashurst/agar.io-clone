# agar.io clone

[![Join the chat at https://gitter.im/huytd/agar.io-clone](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/huytd/agar.io-clone?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

This is a simple Agar.io clone written with Socket.IO and HTML5 Canvas.

![](http://i.imgur.com/yJ96Lyi.jpg)

## Latest Changes
- Game logic handled by server
- Client side is for rendering only
- Display player name
- Now support chat 
- Type to chat box `-ping` to check ping

## Requirement
To run the game, you need to have: 
- NodeJS with NPM installed
- SocketIO 
- Express

## Installation

After clone the source code from Github. You need to run:

```
npm install
```

All the dependencies (socket.io, express,...) will be downloaded.

## Run the server

After download all the dependencies, you can run the server with the following command:

```
node server.js
```

The game will run at http://localhost:3000

## How to play

You are the red circle.

Move mouse on screen to move your self.

Eat all yellow food. Food will respawn every 1 second.

Try to get fat and eat another player.
