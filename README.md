Agar.io Clone
=============

[![GitHub Stars](https://img.shields.io/github/stars/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/issues)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/huytd/agar.io-clone?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A simple Agar.io clone built with socket.io and HTML5 Canvas on top of NodeJS.

![Image](http://i.imgur.com/igXo4xh.jpg)

## Live demo
- OpenShift Server: [![OpenShift](https://img.shields.io/badge/demo-online-green.svg)](https://pillo-nibro.rhcloud.com/)
- Singapore Server: [![Singapore](https://img.shields.io/badge/demo-online-green.svg)](http://codedaily.vn:3000/)

## Latest Changes
- Game logic handled by server
- Client side is for rendering only
- Display player name
- Now supporting chat 
- Type`-ping` in the chatbox to check your ping

## Requirements
To run the game, you'll need: 
- NodeJS with NPM installed
- socket.io 
- Express

## Installation

#### Downloading the Dependencies
After cloning the source code from Github, you need to run the following command to download all the dependencies (socket.io, express, etc.).

```
npm install
```

#### Running the Server

After download all the dependencies, you can run the server with the following command to run the server.

```
node server.js
```

The game will then be accessible at `http://localhost:3000`.

## How to Play

You are the red circle.

Move your mouse on the screen to move yourself.

Eat all yellow food to grow. (Food respawns every time player eat).

Try to get fat and eat other players.

## Gameplay rules
- Player's **mass** is the number of food eaten
- Players who haven't eaten yet can't be eaten.
- Everytime a player joins the game, **3** foods will be spawned
- Everytime a food is eaten by a player, **1** new food will be respawned
- You get slower as you get fatter