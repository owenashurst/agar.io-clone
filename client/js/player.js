let Player = {};

Player.target = { x, y };

Player.entity = {};

Player.update = function(data) {
  for(let key in data) {
    Player.entitiy[key] = data[key];
  }
};

export default Player;
