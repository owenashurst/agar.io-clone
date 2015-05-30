Agar.io Clone
=============

[![GitHub Stars](https://img.shields.io/github/stars/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/issues)
[![GitHub Wiki](https://img.shields.io/badge/project-wiki-ff69b4.svg)](https://github.com/huytd/agar.io-clone/wiki/Home)
[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](#live-demo) "
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/huytd/agar.io-clone?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A simple Agar.io clone built with socket.io and HTML5 Canvas on top of NodeJS.

![Image](http://i.imgur.com/igXo4xh.jpg)

## Live Demo
[![Singapore](https://img.shields.io/badge/singapore-offline-red.svg)](http://codedaily.vn:3000/) "
[![Heroku EU](https://img.shields.io/badge/heroku eu-online-green.svg)](https://agar-clone.herokuapp.com/) "
[![Heroku US](https://img.shields.io/badge/heroku us-online-green.svg)](https://agar-clone-us.herokuapp.com/) "
[![Cloud9](https://img.shields.io/badge/cloud9-online-green.svg)](https://agar-io-clone-d3vont3ch.c9.io/)

---

## How to Play
>You can check out a more elaborated how to play on our [wiki](https://github.com/huytd/agar.io-clone/wiki/How-to-Play)

#### Game Basics
- Move your mouse on the screen to move yourself
- Eat food and other players in order to grow yourself (food respawns every time a player eats it)
- Player's **mass** is the number of food eaten
- Try to get fat and eat other players

#### Gameplay Rules
- Players who haven't eaten yet can't be eaten
- Everytime a player joins the game, **3** foods will be spawned
- Everytime a food is eaten by a player, **1** new food will be respawned
- The more food you eat, the slower you move

---

## Latest Changes
- Game logic handled by server
- Client side is for rendering only
- Display player name
- Now supporting chat 
- Type`-ping` in the chatbox to check your ping

---

## Installation
>You can check out a more detailed setup tutorial on our [wiki](https://github.com/huytd/agar.io-clone/wiki/Setup)

#### Requirements
To run the game, you'll need: 
- NodeJS with NPM installed
- socket.io 
- Express


#### Downloading the Dependencies
After cloning the source code from Github, you need to run the following command to download all the dependencies (socket.io, express, etc.).

```
npm install
```

#### Running the Server
After download all the dependencies, you can run the server with the following command to run the server.

```
node server/server.js
```

or

```
npm start
```

The game will then be accessible at `http://localhost:3000`.

## For Developers
- [Game Architecture](https://github.com/huytd/agar.io-clone/wiki/Game-Architecture)
