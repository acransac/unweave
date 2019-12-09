const { isDebuggerPaused, isSourceTree, isSourceTreeFocus, message, readPauseLocation, scriptHandle } = require('./protocol.js');
const { branches, entryName, fileId, isDirectoryEntry, lookupBranch, lookupNextInBranch, lookupPreviousInBranch, makeSourceTree } = require('./sourcetree.js');

function parseUserInput(parsed, currentInput) {
  if (currentInput === "\x7f") { // If backspace is delete
    return parsed.slice(0, -1);
  }
  else if (currentInput === "\r") {
    return parsed;
  }
  else {
    return `${parsed}${currentInput}`;
  }
}

function describeEnvironment(values) {
  return values.filter(item => !(item.name === "exports" || item.name === "require" || item.name === "module"
			         || item.name === "__filename" || item.name === "__dirname"))
               .reduce((description, item) => {
    return `${description}${item.value.type} ${item.name}${item.value  === "undefined" ? "" : ": " + item.value.value}\n`;
  }, "");
}

function scrollable(content, topLine) {
  return content.split("\n").slice(topLine).reduce((visibleContent, line) => {
    return `${visibleContent === "" ? visibleContent : visibleContent + "\n"}${line}`;
  }, "");
}

function writeTree(visitedSourceTree) {
  const formatEntry = entry => {
    const selectionName = selection => selection.name.split("/").slice(-1)[0];

    return (entryName(entry) === selectionName(visitedSourceTree.selection) ? entryName => `\u001b[7m${entryName}\u001b[0m`
	                                                                    : entryName => entryName)(
      (isDirectoryEntry(entry) ? entryName => colourText(entryName, "cyan")
	                       : entryName => entryName)(
        entryName(entry)));
  };

  return (branchName(visitedSourceTree.selection) === "" ? `${colourText("root", "blue")}\n`
                                                         : `${colourText(branchName(visitedSourceTree.selection), "blue")}\n`) 
    + visitedSourceTree.activeBranch.map(entry => `  ${formatEntry(entry)}\n`).join("");
}

function branchName(selection) {
  if (selection.name === "") {
    return "";
  }
  else {
    return selection.name.split("/").slice(0, -1).join("");
  }
}

function colourText(text, colour) {
  switch (colour) {
    case 'black': return `\u001b[30m${text}\u001b[0m`;
    case 'red': return `\u001b[31m${text}\u001b[0m`;
    case 'green': return `\u001b[32m${text}\u001b[0m`;
    case 'yellow': return `\u001b[33m${text}\u001b[0m`;
    case 'blue': return `\u001b[34m${text}\u001b[0m`;
    case 'magenta': return `\u001b[35m${text}\u001b[0m`;
    case 'cyan': return `\u001b[36m${text}\u001b[0m`;
    case 'white': return `\u001b[37m${text}\u001b[0m`;
  }
}

function exploreSourceTree(sourceTree, activeBranch, selection, stream, continuation, onFilePicked) {
  if (isSourceTree(message(stream))) {
    const newSourceTree = message(stream).sourceTree;

    return continuation(newSourceTree,
                        lookupBranch(newSourceTree, branchName(selection)),
                        selection.name !== "" ? selection : {
                          name: `/${entryName(branches(newSourceTree)[0])}`,
	                  id: isDirectoryEntry(branches(newSourceTree)[0]) ? undefined : fileId(branches(newSourceTree)[0]),
	                  type: isDirectoryEntry(branches(newSourceTree)[0]) ? "directory" : "file"
                        });
  }
  else if (isSourceTreeFocus(message(stream)) && message(stream).focusSourceTree === "j") {
    const nextEntry = lookupNextInBranch(activeBranch, selection.name.split("/").slice(-1)[0], entry => {});

    return continuation(sourceTree,
                        activeBranch,
                        {name: [...selection.name.split("/").slice(0, -1), entryName(nextEntry)].join("/"),
                         id: isDirectoryEntry(nextEntry) ? undefined : fileId(nextEntry),
                         type: isDirectoryEntry(nextEntry) ? "directory" : "file"});
  }
  else if (isSourceTreeFocus(message(stream)) && message(stream).focusSourceTree === "k") {
    const previousEntry = lookupPreviousInBranch(activeBranch, selection.name.split("/").slice(-1)[0], entry => {});

    return continuation(sourceTree,
                        activeBranch,
                        {name: [...selection.name.split("/").slice(0, -1), entryName(previousEntry)].join("/"),
                         id: isDirectoryEntry(previousEntry) ? undefined : fileId(previousEntry),
                         type: isDirectoryEntry(previousEntry) ? "directory" : "file"});
  }
  else if (isSourceTreeFocus(message(stream)) && message(stream).focusSourceTree === "l") {
    if (selection.type === "directory") {
      const newBranch = lookupBranch(sourceTree, selection.name);

      return continuation(sourceTree,
                          newBranch,
                          {name: `${selection.name}/${entryName(newBranch[0])}`,
                           id: isDirectoryEntry(newBranch[0]) ? undefined : fileId(newBranch[0]),
                           type: isDirectoryEntry(newBranch[0]) ? "directory" : "file"});
    }
    else {
      return continuation(sourceTree, activeBranch, selection);
    }
  }
  else if (isSourceTreeFocus(message(stream)) && message(stream).focusSourceTree === "h") {
    const newBranchName = branchName(selection) === "" ? "" : branchName(selection).split("/").slice(0, -1).join("/");

    const newBranch = lookupBranch(sourceTree, newBranchName);

    return continuation(sourceTree,
                        newBranch,
                        {name: `${newBranchName}/${entryName(newBranch[0])}`,
                         id: isDirectoryEntry(newBranch[0]) ? undefined : fileId(newBranch[0]),
                         type: isDirectoryEntry(newBranch[0]) ? "directory" : "file"});
  }
  else if (isSourceTreeFocus(message(stream)) && message(stream).focusSourceTree === "\r" && selection.type === "file") {
    return onFilePicked(sourceTree, activeBranch, selection);
  }
  else {
    return continuation(sourceTree, activeBranch, selection);
  }
}

function displayedScriptSource() {
  const displayUpdater = (sourceTree, activeBranch, selection, scriptId) => (continuation, onDisplayChange) => stream => {
    if (isDebuggerPaused(message(stream))) {
      const currentScriptId = scriptHandle(readPauseLocation(message(stream)));

      if (scriptId !== currentScriptId) {
        return onDisplayChange(displayUpdater(sourceTree, activeBranch, selection, currentScriptId), currentScriptId);
      }
      else {
        return continuation(displayUpdater(sourceTree, activeBranch, selection, currentScriptId), currentScriptId);
      }
    }
    else {
      const selectionChange = (sourceTree, activeBranch, selection) => {
        return continuation(displayUpdater(sourceTree, activeBranch, selection, scriptId), scriptId);
      };

      const displayChange = (sourceTree, activeBranch, selection) => {
        return onDisplayChange(displayUpdater(sourceTree, activeBranch, selection, selection.id), selection.id);
      };
      
      return exploreSourceTree(sourceTree, activeBranch, selection, stream, selectionChange, displayChange);
    }
  };

  return displayUpdater(makeSourceTree(), [], {name: "", id: undefined, type: "file"}, undefined);
}

module.exports = { describeEnvironment, displayedScriptSource, exploreSourceTree, parseUserInput, scrollable, writeTree };
