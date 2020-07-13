const { insertInFileTree, isFileSelected, makeFileEntry, makeFileTree, makeSelectionInFileTree, refreshSelectedFileTree, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectNext, selectPrevious, visitChildBranch, visitParentBranch } = require('filetree');
const { entryUniqueId, entryValue, name, readEnvironment, readEnvironmentEntryUniqueId, sendRequestForEnvironmentEntryDescription, type } = require('./protocol.js');

// # Entry Types
// ## Immediate Entry
// An immediate environment entry is fully defined by its description that is readily available in the environment.
// Examples: a string, a number, a boolean...
function makeImmediateEntry(entry) {
  return makeFileEntry(description(entry), () => {});
}

// ## Deferred Entry
// A deferred environment entry is not fully defined until its content is queried. This happens when visiting it.
// Examples: an object, an array.
function makeDeferredEntry(send, entry) {
  return makeFileEntry(deferredEntryLeafName(), f => f(send, entry));
}

function deferredEntryLeafName() {
  return "deferred";
}

// ## Pending Entry
// A pending environment entry is a deferred entry whose content has been queried but not yet received. It is resolved at reception to a list of child entries, making the former deferred/pending entry a directory.
function makePendingEntry(selection) {
  return (selectedEntry => [
    entryUniqueId(selectedEntryHandle(selectedEntry)((_, entry) => entry)),
    `/env${selectedEntryBranchName(selectedEntry)}`
  ])(selectedEntry(selection));
}

function pendingEntryUniqueId(pendingEntry) {
  return pendingEntry[0];
}

function pendingEntryPath(pendingEntry) {
  return pendingEntry[1];
}

// ## Pending Entries Register
// A pending entries register keeps track of pending entries in an environment tree to allow resolving them and inserting their content when the queries' results are received.
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

function resolvePendingEntry(environmentTree, selection, pendingEntriesRegister, message, environmentReader, send, continuation) {
  const onEntryFound = (newRegister, entryToResolve) => {
    return (newEnvironmentTree => continuation(newEnvironmentTree,
	                                       refreshSelectedEnvironmentTree(selection, newEnvironmentTree),
	                                       newRegister))
             (insertInEnvironmentTree(environmentTree,
		                      pendingEntryPath(entryToResolve),
		                      environmentReader(readEnvironment(message)),
		                      send));
  };

  const onEntryNotFound = register => continuation(environmentTree, selection, register);

  return lookupPendingEntryInRegister(pendingEntriesRegister,
	                              readEnvironmentEntryUniqueId(message),
	                              onEntryFound,
	                              onEntryNotFound);
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

// # Environment Tree
// An environment tree is a reimplementation of filetree that adds the system of deferred entries on top of the file tree and selection. Some behaviour of filetree is left unchanged.
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

// # Selection Types
// ## Selection In Environment Tree
function makeSelectionInEnvironmentTree(environmentTree, selectedBranch, selectedEntry) {
  return makeSelectionInFileTree(environmentTree, selectedBranch, selectedEntry);
}

function refreshSelectedEnvironmentTree(selectionInEnvironmentTree, newEnvironmentTree) {
  return skipDeferredEntry(refreshSelectedFileTree(selectionInEnvironmentTree, newEnvironmentTree));
}

function selectNextEntry(selectionInEnvironmentTree) {
  return selectNext(selectionInEnvironmentTree);
}

function selectPreviousEntry(selectionInEnvironmentTree) {
  return skipDeferredEntry(selectPrevious(selectionInEnvironmentTree));
}

function visitChildEntry(selectionInEnvironmentTree) {
  return (newSelection => {
    if (isDeferredEntrySelected(selectedEntry(newSelection))
	  && isDeferredEntrySelected(selectedEntry(selectNext(newSelection)))) {
      selectedEntryHandle(selectedEntry(newSelection))(sendRequestForEnvironmentEntryDescription);
    }

    return skipDeferredEntry(newSelection);
  })(visitChildBranch(selectionInEnvironmentTree));
}

function visitChildEntrySilently(selectionInEnvironmentTree) {
  return skipDeferredEntry(visitChildBranch(selectionInEnvironmentTree));
}

function visitParentEntry(selectionInEnvironmentTree) {
  return skipDeferredEntry(visitParentBranch(selectionInEnvironmentTree));
}

function skipDeferredEntry(selectionInEnvironmentTree) {
  if (isDeferredEntrySelected(selectedEntry(selectionInEnvironmentTree))) {
    return selectNext(selectionInEnvironmentTree);
  }
  else {
    return selectionInEnvironmentTree;
  }
}

// ## Selected Entry
function isDeferredEntrySelected(selectedEntry) {
  return isFileSelected(selectedEntry) && selectedEntryLeafName(selectedEntry) === deferredEntryLeafName();
}

function isVisitableEntrySelected(selectedEntry) {
  return !isFileSelected(selectedEntry);
}

// # Helpers
function description(entry) {
  return `${type(entry)} ${name(entry)}${entryValue(entry) ? ": " + entryValue(entry) : ""}`;
}

module.exports = {
  deferredEntryLeafName,
  insertInEnvironmentTree,
  isDeferredEntrySelected,
  isVisitableEntrySelected,
  makeEnvironmentTree,
  makePendingEntriesRegister,
  makeSelectionInEnvironmentTree,
  refreshSelectedEnvironmentTree,
  registerPendingEntry,
  resolvePendingEntry,
  selectNextEntry,
  selectPreviousEntry,
  visitChildEntry,
  visitChildEntrySilently,
  visitParentEntry
};
