// Binary Search Tree (BST) implimentation in ECMAScript
//
// A binary search tree provides a data structure for fast lookup, addition, and deletion
// of items by maintaining them in an ordered tree.  This allows O(lg n) searches, additions,
// and removals in the average case (for a balanced tree) and O(n) in the worst case.
//
// Balanced BST to array comparison:
// ____________________________________
//  Operation |   BST     |   Array   |
// -----------------------------------|
//  Insert    |  O(lg n)  |    O(1)   |
//  Update    |  O(lg n)  |    O(n)   |
//  Delete    |  O(lg n)  |    O(n)   |
//  ----------------------------------|
//
//  O(lg n) can be achieved in the worst case by using a Red-Black tree, which prescribes
//  a framework for keeping the tree branches balanced.


// default comparison function
function defaultCompare(a, b) {
    return (a < b) ? -1 : (a > b) ? 1 : 0;
}


/**
* Represents a binary search tree
* @constructor
*/
function BSTree(compare) {

    // pointer to the root of the tree
    this._root = null;

    // default to comparison function
    this._compare = compare || defaultCompare;

    // tree size
    this._size = 0;
}


/**
* Represents a tree node in the binary search tree
* @constructor
* @param {number} id - identifier used in comparing tree nodes
* @param {object} data - any data the node will store
* @param {object} parent - pointer to a parent node, if required
*/
function Node(id, data, parent) {
    this.id     = id;       // id : integer value for comparison
    this.data   = data;     // data : can be anything
    this.left   = null;     // left : pointer to left subtree root
    this.right  = null;     // right : pointer to right subtree root
    this.parent = parent;   // parent : pointer to the parent node
}


/**
* Returns the root node of the tree
*/
BSTree.prototype.getRoot = function () {
    return this._root;
};


/**
* Returns the size of the tree
*/
BSTree.prototype.getSize = function () {
    return this._size;
};


/**
* Returns the minimum node of the tree or subtree
* @param {node} subtreeRoot - root node to begin search from
*/
BSTree.prototype.getMin = function (subtreeRoot) {
    var node = subtreeRoot || this._root;

    while (node.left !== null) {
        node = node.left;
    }

    return node;
};


/**
* Returns the maximum node of the tree or subtree
* @param {node} subtreeRoot - root node to begin search from
*/
BSTree.prototype.getMax = function (subtreeRoot) {
    var node = subtreeRoot || this._root;

    while (node.right !== null) {
        node = node.right;
    }

    return node;
};


/**
* Inserts data into the binary search tree
* @param {number} id - identifier used in comparing tree nodes
* @param {object} data - any data the node will store
*/
BSTree.prototype.insert = function (id, data) {
    var root = this._root,
        currentNode = this._root,
        cmp = this._compare,
        res, dir;

    // if the root is null, then the tree is empty.  The first insert
    // creates the root node
    if (currentNode === null) {
        this._root = new Node(id, data, null);
        this._size += 1;
        return;
    }

    // recurse down the tree so that the node ends up in the correct location
    // according to the comparison function
    currentNode = this._root;
    while (true) {

        // compare the ids
        res = cmp(id, currentNode.id);

        // should the node be inserted to the left or right?
        dir = (res <= 0) ? 'left' : 'right';

        // break if there are no more child nodes on the path so that we
        // can insert a leaf
        if (currentNode[dir] === null) { break; }
        currentNode = currentNode[dir];
    }

    // insert the node into the tree
    currentNode[dir] = new Node(id, data, currentNode);

    // update the tree size
    this._size += 1;
};


/**
* [private] Searches the tree for a given node
* @param {number} id - identifier used in comparing tree nodes
*/
BSTree.prototype._search = function (id) {
    var currentNode = this._root,
        cmp = this._compare,
        res, dir;

    // recurse down the tree using binary search according
    // to the comparison function
    while (currentNode) {

        // compare the ids
        res = cmp(id, currentNode.id);

        // we have a match and can break immediately
        if (res === 0) { break; }

        // pick the direction to continue searching down
        dir = (res < 0) ? 'left' : 'right';
        currentNode = currentNode[dir];
    }

    return currentNode;
};


/**
* Searches the tree for a given node and returns the data associated with that node
* @param {number} id - identifier used in comparing tree nodes
*/
BSTree.prototype.find = function (id) {
    var node = this._search(id);
    return node ? node.data : null;
};


/**
* Removes a node from the tree
* @param {number} id - identifier used in comparing tree nodes
*/
BSTree.prototype.remove = function (id) {
    var node = this._search(id),
        isLeaf,
        isSubTreeRoot,
        branch,
        min,
        max;

    // gracefully return if deleting a non-existant node
    if (node === null) { return; }

    isLeaf = node.left === null && node.right === null;
    isSubTreeRoot = node.left !== null && node.right !== null;

    // root node removal
    // Three options:
    //  1) Tree only has the root node
    //  2) Tree only has one branch from root
    //  3) Tree has two branches from root

    if (this._root === node) {

        // the tree consists of only the root node
        if (isLeaf) {
            this._root = null;

        // node has both left and right trees
        // replace root with the min of the right subtree
        } else if (isSubTreeRoot) {
            min = this.getMin(node.right);

            // replace the reference to the minimum node with the min's right subtree
            min.parent[min.parent.left === min ? 'left' : 'right'] = min.right;

            // delete the reference to the parent from min
            min.parent = null;

            // assign min to the root node
            min.right = node.right;
            min.left = node.left;
            this._root = min;

        // the root only has one branch extending
        // the first node in that branch is now root
        } else {
            this._root = node[node.right === null ? 'left' : 'right'];
            this._root.parent = null;
        }

        this._size -= 1;
        return;
    }

    // We are deleting a node that is not the tree
    // Find the correct node and remove it
    branch = node.parent.left === node ? 'left' : 'right';

    // if the node is a leaf node, simply remove it
    if (isLeaf) {
        node.parent[branch] = null;

    // if the node has left and right subtrees
    } else if (isSubTreeRoot) {
        min = this.getMin(node.right);

        // replace the node with the next largest node
        node.parent[branch] = min;

        // assign the right subtree to the new node
        min.right = node.right;

        // remove the old node's pointer
        min.parent.left = null;

    // node only has one child branch, so move it up the tree
    } else {
      node.parent[branch] = node[node.left === null ? 'right' : 'left'];
    }

    // update tree size
    this._size -= 1;
};


/**
* In order traversal of the tree
*/
BSTree.prototype._asArray = function (node, array) {
    if (node !== null) {
        if (node.left !== null) {
            this._asArray(node.left, array);
        }

        array.push(node.data);

        if (node.right !== null) {
            this._asArray(node.right, array);
        }
    }

    return array;
};


/**
* Returns the contents of the tree as an array
*/
BSTree.prototype.asArray = function () {
    return this._asArray(this._root, []);
};

module.exports = BSTree;

/*
// for testing
var BST = require('./server/lib/bstree');
var tree = new BST();
tree.insert(5,  { name : "5" });
tree.insert(10, { name : "10" });
tree.insert(9, { name : "9" });
tree.insert(8, { name : "8" });
tree.insert(1, { name : "1" });
tree.insert(2, { name : "2" });
tree.insert(0, { name : "0" });
tree.insert(3, { name : "3" });
tree.insert(7, { name : "7" });
tree.insert(4, { name : "4" });
tree.insert(6, { name : "6" });
tree.asArray();
*/


