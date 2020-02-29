const { isFileSelected, makeFileTree, makeSelectionInFileTree } = require('filetree');
const {} = require('./protocol.js');

// Helpers --
//function nameEntry(entry) {
//  return `${type(entry)} ${name(entry)}${entryValue(entry) ? ": " + entryValue(entry) : ""}`;
//}
//
//function isAtomicType(entry) {
//  return type(entry) !== "Array" && type(entry) !== "Object";
//}

// Types --
// Atomic entry
//function makeAtomicEntry(entry) {
//  return makeFileEntry(nameEntry(entry), () => {});
//}

// Deferred collection entry
//function makeDeferredCollectionEntry(send, entry) {
//  return makeDirectoryEntry(nameEntry(entry), [makeFileEntry("Loading...", f => f(send, entry))]);
//}

// Environment tree
function makeEnvironmentTree(branches) {
  return makeFileTree("/env", branches);
}

//function environmentTreeInserter(send, findUniqueId) {
//  return (environmentTree, path, entries) => {
//    return insertInFileTree(environmentTree, path, entries.map(entry => {
//      if (isAtomicEntry(entry)) {
//        return makeAtomicEntry(entry);
//      }
//      else {
//        return makeDeferredCollectionEntry(send, findUniqueId, entry);
//      }
//    }));
//  };
//}

// Selection in environment tree
function makeSelectionInEnvironmentTree(environmentTree, selectedBranch, selectedEntry) {
  return makeSelectionInFileTree(environmentTree, selectedBranch, selectedEntry);
}

// Selected entry
function isAtomicEntrySelected(selectedEntry) {
  return isFileSelected(selectedEntry);
}

module.exports = {
  isAtomicEntrySelected,
  makeEnvironmentTree,
  makeSelectionInEnvironmentTree
};
