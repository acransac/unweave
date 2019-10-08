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

function parseFilePath(url) {
  return (elements => [elements.slice(0, -1).join("/"), elements[elements.length - 1]])(url.split("/"));
}

function directoryName(directoryEntry) {
  return directoryEntry[0];
}

function directoryContent(directoryEntry) {
  return directoryEntry[1];
}

function makeDirectoryEntry(name, content) {
  return [name, content];
}

function isDirectoryEntry(entry) {
  return Array.isArray(entry)
           && entry.length === 2
           && typeof entry[0] === "string"
           && Array.isArray(entry[1])
}

function fileName(fileEntry) {
  return fileEntry.name;
}

function fileId(fileEntry) {
  return fileEntry.id;
}

function entryName(entry) {
  return isDirectoryEntry(entry) ? directoryName(entry) : fileName(entry);
}

function insertInSourceTree(sourceTree, path, file) {
  const insertInSourceTreeImpl = (sourceTree, path, file) => {
    if (path.length === 0) {
      return [...sourceTree, file];
    }
    else if (sourceTree.length === 0) {
      return [makeDirectoryEntry(path[0], insertInSourceTreeImpl(sourceTree, path.slice(1), file))];
    }
    else {
      if (!isDirectoryEntry(sourceTree[0])) {
        return [].concat([sourceTree[0]], insertInSourceTreeImpl(sourceTree.slice(1), path, file));
      }
      else {
        if (directoryName(sourceTree[0]) === path[0]) {
          return [makeDirectoryEntry(path[0], insertInSourceTreeImpl(directoryContent(sourceTree[0]), path.slice(1), file)),
		  ...sourceTree.slice(1)];
        }
	else {
	  return [].concat([sourceTree[0]], insertInSourceTreeImpl(sourceTree.slice(1), path, file));
        }
      }
    }
  };

  return {root: sourceTree.root,
	  branches: insertInSourceTreeImpl(sourceTree.branches, path.slice(sourceTree.root.length).split("/").slice(1), file)};
}

function lookupBranch(sourceTree, path) {
  const lookupBranchImpl = (sourceTree, path) => {
    if (path.length === 0) {
      return sourceTree;
    }
    else if (sourceTree.length === 0) {
      return [];
    }
    else if (isDirectoryEntry(sourceTree[0]) && directoryName(sourceTree[0]) === path[0]) {
      return lookupBranchImpl(directoryContent(sourceTree[0]), path.slice(1));
    }
    else {
      return lookupBranchImpl(sourceTree.slice(1), path);
    }
  };

  return lookupBranchImpl(sourceTree.branches, path.split("/").slice(1));
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
  const lookupPreviousInBranchImpl = previous => (branch, namedEntry, errorFunction) => {
    if (branch.length === 0) {
      return errorFunction(namedEntry);
    }
    else if (entryName(branch[0]) === namedEntry) {
      return previous;
    }
    else {
      return lookupPreviousInBranchImpl(branch[0])(branch.slice(1), namedEntry, errorFunction);
    }
  };

  return lookupPreviousInBranchImpl(branch[0])(branch, namedEntry, errorFunction);
}

module.exports = { parseFilePath, insertInSourceTree, isDirectoryEntry, directoryName, directoryContent, fileName, fileId, entryName, lookupBranch, lookupNextInBranch, lookupPreviousInBranch };
