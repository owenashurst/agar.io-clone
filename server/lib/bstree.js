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
        isLeft, isRight;

    // gracefully return if deleting a non-existant node
    if (node === null) { return; }

    isLeft = node.parent.left === node.id;
    isRight = node.parent.right === node.id;

    // if the node is a leaf node, simply remove it
    if (node.left === null && node.right === null) {

        // remove parent's reference to the node
        node.parent[isLeft ? 'left' : 'right'] = null;

    // if node has a right subtree
    } else if (node.left === null) {

        // move the right subtree up to the appropriate position on the parent
        node.parent[isLeft ? 'left' : 'right'] = node.right;

    // if node has a left subtree
    } else if (node.right === null) {

        // move the left subtree up to the appropriate position on the parent
        node.parent[isLeft ? 'left' : 'right'] = node.left;

    // if node has both right and left subtrees
    } else {
        var min = this.getMin(node.right);

        // replace the node with the next largest node
        node.parent[isLeft ? 'left' : 'right'] = min;

        // assign the right subtree to the new node
        min.right = node.right;

        // remove the old node's pointer
        min.parent.left = null;
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
