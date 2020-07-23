const { insertInFileTree, isFileSelected, makeFileEntry, makeFileTree, makeSelectionInFileTree, refreshSelectedFileTree, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectNext, selectPrevious, visitChildBranch, visitParentBranch } = require('@acransac/filetree');
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

/*
 * Get the name tagging all deferred entries
 * @return {string}
 */
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

/*
 * Make a pending entries register
 * @param {PendingEntry[]} [pendingEntries: []] - An array of the current pending entries. Specify only in advanced usage
 * @return {PendingEntriesRegister}
 */
function makePendingEntriesRegister(pendingEntries) {
  return pendingEntries ? pendingEntries : [];
}

/*
 * Register a pending entry for future resolution
 * @param {PendingEntriesRegister} pendingEntriesRegister - A pending entries register
 * @param {Selection} selection - The selected pending entry
 * @return {PendingEntriesRegister}
 */
function registerPendingEntry(pendingEntriesRegister, selection) {
  if (isDeferredEntrySelected(selectedEntry(selection))) {
    return [...pendingEntriesRegister, makePendingEntry(selection)];
  }
  else {
    return pendingEntriesRegister;
  }
}

/*
 * Resolve a pending entry, making it a directory where the queried content is inserted and clearing it out of the register
 * @param {EnvironmentTree} environmentTree - The environment tree to which the pending entry belongs
 * @param {Selection} selection - The current selection in the environment tree
 * @param {PendingEntriesRegister} pendingEntriesRegister - The current pending entries register
 * @param {Message} message - The current message
 * @param {function} environmentReader - A function that extracts the environment entries from the current message
 * @param {function} send - A callback that sends requests over websocket to Inspector
 * @param {function} continuation - A function that defines the subsequent logic to execute and which receives the updated environment tree, selection and register
 * @return {*} - The result of the continuation is returned
 */
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

/*
 * Make an environment tree
 * @param {Branches} [branches: []] - The content of the tree. Specify only in advanced usage
 * @return {EnvironmentTree}
 */
function makeEnvironmentTree(branches) {
  return makeFileTree("/env", branches);
}

/*
 * Insert entries in an environment tree
 * @param {EnvironmentTree} environmentTree - An environment tree
 * @param {string} path - The path to the entries
 * @param {EnvironmentEntryDescription[]} entries - An array of environment entries' descriptions as sent by Inspector
 * @param {function} send - A callback that send requests over websocket to Inspector
 * @return {EnvironmentTree}
 */
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

/*
 * Make a selection in an environment tree
 * @param {EnvironmentTree} environmentTree - An environment tree. It should be empty. Specify only in advanced usage
 * @param {Branches} [selectedBranch] - The branch to which the selection belongs. It is not used if the environment tree is empty. Specify only in advanced usage
 * @param {SelectedEntry} [selectedEntry] - The selected entry. It is not used if the environment tree is empty. Specify only in advanced usage
 * @return {Selection}
 */
function makeSelectionInEnvironmentTree(environmentTree, selectedBranch, selectedEntry) {
  return makeSelectionInFileTree(environmentTree, selectedBranch, selectedEntry);
}

/*
 * Update the environment tree and selected branch associated with a selection
 * @param {Selection} selectionInEnvironmentTree - A selection whose referenced environment tree has just been updated
 * @param {EnvironmentTree} newEnvironmentTree - The updated environment tree
 * @return {Selection}
 */
function refreshSelectedEnvironmentTree(selectionInEnvironmentTree, newEnvironmentTree) {
  return skipDeferredEntry(refreshSelectedFileTree(selectionInEnvironmentTree, newEnvironmentTree));
}

/*
 * Select the next entry in the selected branch of a selection
 * @param {Selection} selectionInEnvironmentTree - A selection
 * @return {Selection} - If there is no next entry, the original selection is returned
 */
function selectNextEntry(selectionInEnvironmentTree) {
  return selectNext(selectionInEnvironmentTree);
}

/*
 * Select the previous entry in the selected branch of a selection
 * @param {Selection} selectionInEnvironmentTree - A selection
 * @return {Selection} - If there is no previous entry, the original selection is returned
 */
function selectPreviousEntry(selectionInEnvironmentTree) {
  return skipDeferredEntry(selectPrevious(selectionInEnvironmentTree));
}

/*
 * Change the selected branch for the available content of a selected entry and select its first item. If the entry is deferred, query the content
 * @param {Selection} selectionInEnvironmentTree - A selection
 * @return {Selection} - If the original selection is immediate, it is returned
 */
function visitChildEntry(selectionInEnvironmentTree) {
  return (newSelection => {
    if (isDeferredEntrySelected(selectedEntry(newSelection))
	  && isDeferredEntrySelected(selectedEntry(selectNext(newSelection)))) {
      selectedEntryHandle(selectedEntry(newSelection))(sendRequestForEnvironmentEntryDescription);
    }

    return skipDeferredEntry(newSelection);
  })(visitChildBranch(selectionInEnvironmentTree));
}

/*
 * Change the selected branch for the available content of a selected entry and select its first item. If the entry is deferred, it is not queried
 * @param {Selection} selectionInEnvironmentTree - A selection
 * @return {Selection} - If the original selection is immediate, it is returned
 */
function visitChildEntrySilently(selectionInEnvironmentTree) {
  return skipDeferredEntry(visitChildBranch(selectionInEnvironmentTree));
}

/*
 * Change the selected branch for the content of the parent entry and select its first item
 * @param {Selection} selectionInEnvironmentTree - A selection
 * @return {Selection} - If the original selection has no parent entry, a selection on the first item of the current sequence of entries is returned
 */
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

/*
 * Check whether a selected entry is a deferred entry
 * @param {SelectedEntry} selectedEntry - A selected entry
 * @return {boolean}
 */
function isDeferredEntrySelected(selectedEntry) {
  return isFileSelected(selectedEntry) && selectedEntryLeafName(selectedEntry) === deferredEntryLeafName();
}

/*
 * Check whether a selected entry is a deferred entry or a pending entry
 * @param {SelectedEntry} selectedEntry - A selected entry
 * @return {boolean}
 */
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
