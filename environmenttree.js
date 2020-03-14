const { insertInFileTree, isFileSelected, makeFileEntry, makeFileTree, makeSelectionInFileTree, refreshSelectedFileTree, selectedEntry, selectedEntryHandle, selectedEntryLeafName, selectNext, visitChildBranch, visitParentBranch } = require('filetree');
const { entryValue, name, readUniqueId, sendRequestForEntryDescription, type } = require('./protocol.js');

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
  return makeFileEntry("deferred", f => f(send, entry));
}

// Pending entry
function makePendingEntry(selection) {
  return (selectedEntry => [
    readUniqueId(selectedEntryHandle(selectedEntry)((_, entry) => entry)),
    `/env/${selectedEntryName(selectedEntry(selection))}`
  ])(selectedEntry(selection));
}

function pendingEntryUniqueId(pendingEntry) {
  return pendingEntry[0];
}

function pendingEntryPath(pendingEntry) {
  return pendingEntry[1];
}

function makePendingEntriesRegister(pendingEntries) {
  return pendingEntries ? pendingEntries : [];
}

function registerPendingEntry(pendingEntriesRegister, selection) {
  if (isDeferredEntrySelected(selectedEntry(selection))) {
    return [...pendingEntriesRegister, makePendingEntry(selection)];
  }
  else {
    return pendingEntriesRegister;
  }
}

function lookupPendingEntryInRegister(pendingEntriesRegister, lookedupEntryUniqueId, onEntryFound, onEntryNotFound) {
  const lookupImpl = (newRegister, entries) => {
    if (entries.length === 0) {
      return onEntryNotFound(newRegister);
    }
    else if (pendingEntryUniqueId(entries[0]) === lookedupEntryUniqueId) {
      return onEntryFound(makePendingEntriesRegister([...newRegister, ...entries.slice(1)]), entries[0]);
    }
    else {
      return lookupImpl(makePendingEntriesRegister([...newRegister, entries[0]]), entries.slice(1));
    }
  };

  return lookupImpl(makePendingEntriesRegister(), pendingEntriesRegister);
}

function resolvePendingEntry(environmentTree, selection, pendingEntriesRegister, message, send, continuation) {
  const onEntryFound = (newRegister, entryToResolve) => {
    return (newEnvironmentTree => continuation(newEnvironmentTree,
	                                       refreshSelectedEnvironmentTree(selection, newEnvironmentTree),
	                                       newRegister))
             (insertInEnvironmentTree(environmentTree, pendingEntryPath(entryToResolve), readEnvironment(message), send));
  };

  const onEntryNotFound = register => continuation(environmentTree, selection, register);

  return lookupPendingEntryInRegister(pendingEntriesRegister,
	                              readEnvironmentEntryUniqueId(message),
	                              onEntryFound,
	                              onEntryNotFound);
}

// Environment tree
function makeEnvironmentTree(branches) {
  return makeFileTree("/env", branches);
}

function insertInEnvironmentTree(environmentTree, path, entries, send) {
  return entries.reduce((newEnvironmentTree, entry) => {
    if (type(entry) === "Object" || type(entry) === "Array") {
      return insertInFileTree(newEnvironmentTree, `${path}/${description(entry)}`, makeDeferredEntry(send, entry));
    }
    else {
      return insertInFileTree(newEnvironmentTree, path, makeImmediateEntry(entry));
    }
  }, environmentTree);
}

// Selection in environment tree
function makeSelectionInEnvironmentTree(environmentTree, selectedBranch, selectedEntry) {
  return makeSelectionInFileTree(environmentTree, selectedBranch, selectedEntry);
}

function refreshSelectedEnvironmentTree(selectionInEnvironmentTree, newEnvironmentTree) {
  return refreshSelectedFileTree(selectionInEnvironmentTree, newEnvironmentTree);
}

function visitChildEntry(selectionInEnvironmentTree) {
  return (newSelection => {
    if (isDeferredEntrySelected(selectedEntry(newSelection))
	  && isDeferredEntrySelected(selectedEntry(selectNext(newSelection)))) {
      selectedEntryHandle(selectedEntry(newSelection))(sendRequestForEntryDescription);

      return newSelection;
    }
    else if (isDeferredEntrySelected(selectedEntry(newSelection))) {
      return selectNext(newSelection);
    }
    else {
      return newSelection;
    }
  })(visitChildBranch(selectionInEnvironmentTree));
}

function visitParentEntry(selectionInEnvironmentTree) {
  return visitParentBranch(selectionInEnvironmentTree);
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
  makePendingEntriesRegister,
  makeSelectionInEnvironmentTree,
  refreshSelectedEnvironmentTree,
  registerPendingEntry,
  visitChildEntry,
  visitParentEntry
};
