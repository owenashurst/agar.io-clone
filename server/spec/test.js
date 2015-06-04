
var BST =  require('./lib/bstree');

var tree = new BST();

function Player() {
  return {
    name : "random",
    id : Math.random()
  };
}

var N = 10000,
    i = 0;

while (i < N) {
  var p = Player();
  tree.insert(p.id, p);
  i += 1;
}
