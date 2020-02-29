const { isAtomicEntrySelected, makeEnvironmentTree, makeSelectionInEnvironmentTree } = require('./environmenttree.js');
const { branches, root, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectedEntryName } = require('filetree');
const Test = require('tester');

function test_emptyEnvironmentTree(finish, check) {
  const emptyEnvironmentTree = makeEnvironmentTree();

  return finish(check(root(emptyEnvironmentTree) === "/env"
	                && branches(emptyEnvironmentTree).length === 0));
}

function test_selectionInEmptyEnvironmentTree(finish, check) {
  const emptySelection = makeSelectionInEnvironmentTree(makeEnvironmentTree());

  return finish(check(selectedBranch(emptySelection).length === 0
	                && selectedEntryName(selectedEntry(emptySelection)) === ""
	                && selectedEntryLeafName(selectedEntry(emptySelection)) === ""
	                && selectedEntryBranchName(selectedEntry(emptySelection)) === ""
	                && selectedEntryHandle(selectedEntry(emptySelection)) === undefined
	                && isAtomicEntrySelected(selectedEntry(emptySelection))));
}

Test.run([
  Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
  Test.makeTest(test_selectionInEmptyEnvironmentTree, "Selection In Empty Environment Tree")
]);
