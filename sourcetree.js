//testSourceTreeParser();

function testSourceTreeParser() {
  const [pathA, fileNameA] = parseFilePath("file:///A/B/a.js".slice("file://".length));
  const [pathB, fileNameB] = parseFilePath("file:///A/B/b.js".slice("file://".length));
  const [pathC, fileNameC] = parseFilePath("file:///A/B/C/c.js".slice("file://".length));
  const [pathD, fileNameD] = parseFilePath("file:///A/d.js".slice("file://".length));
  const [pathE, fileNameE] = parseFilePath("file:///A/B/D/e.js".slice("file://".length));

  const sourceTreeA = insertInSourceTree({root: "/A", branches: []}, pathA, {name: fileNameA, id: 0});
  const sourceTreeB = insertInSourceTree(sourceTreeA, pathB, {name: fileNameB, id: 1});
  const sourceTreeC = insertInSourceTree(sourceTreeB, pathC, {name: fileNameC, id: 2});
  const sourceTreeD = insertInSourceTree(sourceTreeC, pathD, {name: fileNameD, id: 3});
  const sourceTreeE = insertInSourceTree(sourceTreeD, pathE, {name: fileNameE, id: 4});

  console.log(JSON.stringify(sourceTreeA));
  console.log(JSON.stringify(sourceTreeB));
  console.log(JSON.stringify(sourceTreeC));
  console.log(JSON.stringify(sourceTreeD));
  console.log(JSON.stringify(sourceTreeE));
}

// Helpers --
function parseFilePath(fullPath) {
  return (elements => [elements.slice(0, -1).join("/"), elements[elements.length - 1]])(fullPath.split("/"));
}

// Types --
// Directory
function makeDirectoryEntry(name, content) {
  return [name, content];
}

function isDirectoryEntry(entry) {
  return Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" && Array.isArray(entry[1])
}

function directoryName(directoryEntry) {
  return directoryEntry[0];
}

function directoryContent(directoryEntry) {
  return directoryEntry[1];
}

// File
function makeFileEntry(name, id) {
  return [name, id];
}

function fileName(fileEntry) {
  return fileEntry[0];
}

function fileId(fileEntry) {
  return fileEntry[1];
}

// Entry
function entryName(entry) {
  return isDirectoryEntry(entry) ? directoryName(entry) : fileName(entry);
}

// Source tree
function makeSourceTree(root, branches) {
  return [root, branches ? branches : []];
}

function root(sourceTree) {
  return sourceTree[0];
}

function branches(sourceTree) {
  return sourceTree[1];
}

function insertInSourceTree(sourceTree, path, file) {
  const insertInSourceTreeImpl = (entries, branch, path, file) => {
    if (path.length === 0) {
      return [...entries, ...branch, file];
    }
    else if (branch.length === 0) {
      return [...entries, makeDirectoryEntry(path[0], insertInSourceTreeImpl([], [], path.slice(1), file))];
    }
    else if (isDirectoryEntry(branch[0]) && directoryName(branch[0]) === path[0]) {
      return [...entries,
	      makeDirectoryEntry(path[0], insertInSourceTreeImpl([], directoryContent(branch[0]), path.slice(1), file)),
	      ...branch.slice(1)];
    }
    else {
      return insertInSourceTreeImpl([...entries, branch[0]], branch.slice(1), path, file);
    }
  };

  if (root(sourceTree) === undefined) {
    return makeSourceTree(path, [file]);
  }
  else {
    return makeSourceTree(root(sourceTree),
	                  insertInSourceTreeImpl([],
				                 branches(sourceTree),
				                 path.slice(root(sourceTree).length).split("/").slice(1),
				                 file));
  }
}

function lookupBranch(sourceTree, path) {
  const lookupBranchImpl = (branch, path) => {
    if (path.length === 0) {
      return branch;
    }
    else if (branch.length === 0) {
      return [];
    }
    else if (isDirectoryEntry(branch[0]) && directoryName(branch[0]) === path[0]) {
      return lookupBranchImpl(directoryContent(branch[0]), path.slice(1));
    }
    else {
      return lookupBranchImpl(branch.slice(1), path);
    }
  };

  return lookupBranchImpl(branches(sourceTree), path.split("/").slice(1));
}

function lookupNextInBranch(branch, namedEntry, errorFunction) {
  if (branch.length === 0) {
    return errorFunction(namedEntry);
  }
  else if (entryName(branch[0]) === namedEntry) {
    if (branch.length === 1) {
      return branch[0];
    }
    else {
      return branch[1];
    }
  }
  else {
    return lookupNextInBranch(branch.slice(1), namedEntry, errorFunction);
  }
}

function lookupPreviousInBranch(branch, namedEntry, errorFunction) {
  const lookupPreviousInBranchImpl = (previous, branch, namedEntry, errorFunction) => {
    if (branch.length === 0) {
      return errorFunction(namedEntry);
    }
    else if (entryName(branch[0]) === namedEntry) {
      return previous;
    }
    else {
      return lookupPreviousInBranchImpl(branch[0], branch.slice(1), namedEntry, errorFunction);
    }
  };

  return lookupPreviousInBranchImpl(branch[0], branch, namedEntry, errorFunction);
}

// Selection in source tree
function makeSelectionInSourceTree(sourceTree, selectedBranch, selectedEntry) {
  if (branches(sourceTree).length === 0) {
    return [sourceTree, [], makeSelectedEntry()];
  }
  else {
    return [sourceTree,
	    selectedBranch,
	    selectedEntryName(selectedEntry) === ""
	      ? makeSelectedEntry(`/${entryName(branches(sourceTree)[0])}`,
	                          isDirectoryEntry(branches(sourceTree)[0]) ? undefined : fileId(branches(sourceTree)[0]),
	                          isDirectoryEntry(branches(sourceTree)[0]) ? "directory" : "file")
	      : selectedEntry];
  }
}

function selectedSourceTree(selectionInSourceTree) {
  return selectionInSourceTree[0];
}

function selectedBranch(selectionInSourceTree) {
  return selectionInSourceTree[1];
}

function selectedEntry(selectionInSourceTree) {
  return selectionInSourceTree[2];
}

function refreshSelectedSourceTree(selectionInSourceTree, newSourceTree) {
  return makeSelectionInSourceTree(newSourceTree, 
                                   lookupBranch(newSourceTree, selectedEntryBranchName(selectedEntry(selectionInSourceTree))),
	                           selectedEntry(selectionInSourceTree));
}

function selectAnotherEntryInBranch(selectionInSourceTree, selector) {
  const otherEntry = selector(selectedBranch(selectionInSourceTree),
	                      selectedEntryLeafName(selectedEntry(selectionInSourceTree)),
	                      entry => {});

  return makeSelectionInSourceTree(selectedSourceTree(selectionInSourceTree),
                                   selectedBranch(selectionInSourceTree),
	                           makeSelectedEntry(selectedEntryBranchName(selectedEntry(selectionInSourceTree)) + `/${entryName(otherEntry)}`,
                                                     isDirectoryEntry(otherEntry) ? undefined : fileId(otherEntry),
                                                     isDirectoryEntry(otherEntry) ? "directory" : "file"));
}

function selectNext(selectionInSourceTree) {
  return selectAnotherEntryInBranch(selectionInSourceTree, lookupNextInBranch);
}

function selectPrevious(selectionInSourceTree) {
  return selectAnotherEntryInBranch(selectionInSourceTree, lookupPreviousInBranch);
}

function selectAnotherBranch(selectionInSourceTree, branchName) {
  const newBranch = lookupBranch(selectedSourceTree(selectionInSourceTree), branchName);

  return makeSelectionInSourceTree(selectedSourceTree(selectionInSourceTree),
                                   newBranch,
	                           makeSelectedEntry(selectedEntryBranchName(selectedEntry(selectionInSourceTree)) + `/${entryName(newBranch[0])}`,
                                                     isDirectoryEntry(newBranch[0]) ? undefined : fileId(newBranch[0]),
                                                     isDirectoryEntry(newBranch[0]) ? "directory" : "file"));
}

function visitChildBranch(selectionInSourceTree) {
  if (isDirectorySelected(selectedEntry(selectionInSourceTree))) {
    return selectAnotherBranch(selectionInSourceTree, selectedEntryName(selectedEntry(selectionInSourceTree)));
  }
  else {
    return selectionInSourceTree;
  }
}

function visitParentBranch(selectionInSourceTree) {
  const newBranchName = selectedEntryBranchName(selectedEntry(selectionInSourceTree)) === ""
    ? ""
    : selectedEntryBranchName(selectedEntry(selectionInSourceTree)).split("/").slice(0, -1).join("/");

  return selectAnotherBranch(selectionInSourceTree, newBranchName);
}

// Selected entry
function makeSelectedEntry(name, handle, type) {
  return [name ? name : "", handle, type ? type : "file"];
}

function selectedEntryName(selectedEntry) {
  return selectedEntry[0];
}

function selectedEntryLeafName(selectedEntry) {
  return selectedEntryName(selectedEntry).split("/").slice(-1)[0];
}

function selectedEntryBranchName(selectedEntry) {
  if (selectedEntryName(selectedEntry) === "") {
    return "";
  }
  else {
    return selectedEntryName(selectedEntry).split("/").slice(0, -1).join("");
  }
}

function selectedEntryHandle(selectedEntry) {
  return selectedEntry[1];
}

function selectedEntryType(selectedEntry) {
  return selectedEntry[2];
}

function isFileSelected(selectedEntry) {
  return selectedEntryType(selectedEntry) === "file";
}

function isDirectorySelected(selectedEntry) {
  return selectedEntryType(selectedEntry) === "directory";
}

module.exports = {
  branches,
  entryName,
  fileName,
  insertInSourceTree,
  isDirectoryEntry,
  isFileSelected,
  makeFileEntry,
  makeSelectionInSourceTree,
  makeSourceTree,
  parseFilePath,
  refreshSelectedSourceTree,
  root,
  selectedBranch,
  selectedEntry,
  selectedEntryBranchName,
  selectedEntryHandle,
  selectedEntryLeafName,
  selectNext,
  selectPrevious,
  visitChildBranch,
  visitParentBranch
};
