Agar.io Clone
=============

[![GitHub Stars](https://img.shields.io/github/stars/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/issues)
[![GitHub Wiki](https://img.shields.io/badge/project-wiki-ff69b4.svg)](https://github.com/huytd/agar.io-clone/wiki/Home)
[![Build Status](https://api.travis-ci.org/huytd/agar.io-clone.svg)]
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
- Move your mouse on the screen to move your character
- Eat food and other players in order to grow your character (food respawns every time a player eats it)
- A player's **mass** is the number of food particles eaten
- **Objective**: Try to get fat and eat other players

#### Gameplay Rules
- Players who haven't eaten yet cannot be eaten
- Everytime a player joins the game, **3** food particles will spawn
- Everytime a food particle is eaten by a player, **1** new food particle will respawn
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
After downloading all the dependencies, you can run the server with the following command:

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

## FAQ
1. **What is this game?**

  This is a clone of the AgarIO game ([http://agar.io](http://agar.io)). Somebody said that AgarIO is a clone of the game Osmos on the iPad, I have no idea because I have not played Osmos yet. (Hey! Cloneception =]] )
2. **Why you clone this game?**

  Well. The original game is still online, but it's closed source. And sometimes, it's subject to damn lag. I can play very well at my company (don't tell my boss!) but can't even connect when I'm at home. That's why me and the contributors want to make an open source version of this game, for learning purposes, and to let the community add some awesome features as they want, self-host on their own server to have fun with friends,...
3. **Any plan for an online server to compete with AgarIO or make some money?**

  Actually no! This game belongs to the community, and I have no plan to make money or compete with any product with this. And I won't have enough time to run my own server. But if you want, you can do it.
4. **Can I deploy this game to my own server?**

  Yes you can! This game was made for that!
5. **I don't like HTML5 Canvas. Can I write my own game client with this server?**

  Yes for sure. As long as your client supports WebSockets, you can write your game client in any language/technology, even with Unity3D (there is an open source library for Unity to communicate with WebSockets).
6. **Can I use some code in this project to my own project?**

  Yes you can.

## License
This project is licensed under the terms of the **MIT** license.
