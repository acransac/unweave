const { makeEnvironmentTree } = require('./environmenttree.js');
const { branches, root } = require('filetree');
const Test = require('tester');

function test_emptyEnvironmentTree(finish, check) {
  const emptyEnvironmentTree = makeEnvironmentTree();

  return finish(check(root(emptyEnvironmentTree) === "/env"
	                && branches(emptyEnvironmentTree).length === 0));
}

Test.run([
  Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
]);
