const { insertInFileTree, isFileSelected, makeDirectoryEntry, makeFileEntry, makeFileTree, makeSelectionInFileTree, refreshSelectedFileTree, selectedEntry, selectedEntryHandle, selectedEntryLeafName, visitChildBranch } = require('filetree');
const { entryValue, name, sendRequestForEntryDescription, type } = require('./protocol.js');

// Helpers --
function description(entry) {
  return `${type(entry)} ${name(entry)}${entryValue(entry) ? ": " + entryValue(entry) : ""}`;
}

// Types --
// Immediate entry
function makeImmediateEntry(entry) {
  return makeFileEntry(description(entry), () => {});
}

// Deferred entry
function makeDeferredEntry(send, entry) {
  return makeDirectoryEntry(description(entry), [makeFileEntry("deferred", f => f(send, entry))]);
}

// Environment tree
function makeEnvironmentTree(branches) {
  return makeFileTree("/env", branches);
}

function insertInEnvironmentTree(environmentTree, path, entries, send) {
  return insertInFileTree(environmentTree, path, ...entries.map(entry => {
    if (type(entry) === "Object" || type(entry) === "Array") {
      return makeDeferredEntry(send, entry);
    }
    else {
      return makeImmediateEntry(entry);
    }
  }));
}

// Selection in environment tree
function makeSelectionInEnvironmentTree(environmentTree, selectedBranch, selectedEntry) {
  return makeSelectionInFileTree(environmentTree, selectedBranch, selectedEntry);
}

function refreshSelectedEnvironmentTree(selectionInEnvironmentTree, newEnvironmentTree) {
  return refreshSelectedFileTree(selectionInEnvironmentTree, newEnvironmentTree);
}

function visitEnvironmentEntry(selectionInEnvironmentTree) {
  return (newSelection => {
    if (isDeferredEntrySelected(selectedEntry(newSelection))) {
      selectedEntryHandle(selectedEntry(newSelection))(sendRequestForEntryDescription);
    }

    return newSelection;
  })(visitChildBranch(selectionInEnvironmentTree));
}

// Selected entry
function isVisitableEntrySelected(selectedEntry) {
  return !isFileSelected(selectedEntry);
}

function isDeferredEntrySelected(selectedEntry) {
  return isFileSelected(selectedEntry) && selectedEntryLeafName(selectedEntry) === "deferred";
}

module.exports = {
  insertInEnvironmentTree,
  isDeferredEntrySelected,
  isVisitableEntrySelected,
  makeEnvironmentTree,
  makeSelectionInEnvironmentTree,
  refreshSelectedEnvironmentTree,
  visitEnvironmentEntry
};
