Agar.io Clone
=============

[![GitHub Stars](https://img.shields.io/github/stars/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/huytd/agar.io-clone.svg)](https://github.com/huytd/agar.io-clone/issues)
[![GitHub Wiki](https://img.shields.io/badge/project-wiki-ff69b4.svg)](https://github.com/huytd/agar.io-clone/wiki/Home)
![Build Status](https://api.travis-ci.org/huytd/agar.io-clone.svg)
[![Live Demo](https://img.shields.io/badge/demo-online-green.svg)](#live-demo) "
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/huytd/agar.io-clone?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

A simple Agar.io clone built with socket.io and HTML5 Canvas on top of NodeJS.

![Image](http://i.imgur.com/O3rP7cg.png)

## Live Demo
[![Singapore](https://img.shields.io/badge/singapore-offline-red.svg)](http://codedaily.vn:3000/) "
[![Heroku EU](https://img.shields.io/badge/heroku eu-online-green.svg)](https://agar-clone.herokuapp.com/) "
[![Heroku US](https://img.shields.io/badge/heroku us-online-green.svg)](https://agar-clone-us.herokuapp.com/) "
[![Cloud9](https://img.shields.io/badge/cloud9-online-green.svg)](https://agar-io-clone-d3vont3ch.c9.io/) "
[![TS3Bahu](https://img.shields.io/badge/TS3Bahu-online-green.svg)](http://agar.ts3bahu.com:3000) "

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

## FAQ
1. **What is this game?**

  This is a clone of the game [Agar.IO](http://agar.io/). Someone said that Agar.IO is a clone of an iPad game called Osmos, but we haven't tried it yet. (Cloneception? :P)
  
2. **Why would you make a clone of this game?**

  Well, while the original game is still online, it's closed source, and sometimes, it suffers from massive lag. That's why we want to make an open source version of it: for learning purposes, and to let the community add some awesome features that they want, self-host on their own servers to have fun with some friends.
  
3. **Any plans on adding an online server to compete with Agar.IO or making money out of it?**

  No. This game belongs to the open-source community, and we have no plans on making money out of it nor competing with anything. But you surely can create your own public server, let us know if you do so and we can add it to our Live Demos list.
  
4. **Can I deploy this game to my own server?**

  Sure you can! That's what it's made for ;)
  
5. **I don't like HTML5 Canvas. Can I write my own game client with this server?**

  Sure. As long as your client supports WebSockets, you can write your game client in any language/technology, even with Unity3D if you want (there is an open source library for Unity to communicate with WebSockets).
  
6. **Can I use some code of this project on my own?**

  Yes you can.

## For Developers
 - [Game Architecture](https://github.com/huytd/agar.io-clone/wiki/Game-Architecture)

## License
>You can check out the full license [here](https://github.com/huytd/agar.io-clone/blob/master/LICENSE)

This project is licensed under the terms of the **MIT** license.
