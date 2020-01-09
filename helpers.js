const { isDebuggerPaused, isSourceTree, isSourceTreeFocus, message, pauseLocation, readSourceTree, scriptHandle, sourceTreeFocusInput } = require('./protocol.js');
const { entryName, isDirectoryEntry, isFileSelected, makeSelectionInSourceTree, makeSourceTree, refreshSelectedSourceTree, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectNext, selectPrevious, visitChildBranch, visitParentBranch } = require('./sourcetree.js');

function parseUserInput(parsed, currentInput) {
  if (isBackspace(currentInput)) {
    return parsed.slice(0, -1);
  }
  else if (currentInput === "\r") {
    return parsed;
  }
  else {
    return `${parsed}${currentInput}`;
  }
}

function isBackspace(input) {
  return input === "\x7f";
}

function isCtrlC(input) {
  return input === "\x03";
}

function describeEnvironment(values) {
  const describeValue = environmentItem => {
    const makeValueDescription = (environmentItem, valueTypeName) => {
      return {
        name: environmentItem.name,
	type: valueTypeName ? valueTypeName : environmentItem.value.className,
	value: (environmentItem.value.type === "string" ? value => `\"${value}\"` :  value => value)
	         (environmentItem.value.value)
      };
    };

    const describeObject = environmentItem => {
      if (environmentItem.value.subtype === "null") {
	return makeValueDescription(environmentItem, "Null");
      }
      else if (environmentItem.value.subtype === "proxy") {
	return makeValueDescription(environmentItem, "Proxy");
      }
      else {
	return makeValueDescription(environmentItem);
      }
    };

    switch (environmentItem.value.type) {
      case "undefined":
	return makeValueDescription(environmentItem, "Undefined");
      case "symbol":
	return makeValueDescription(environmentItem, "Symbol");
      case "boolean":
	return makeValueDescription(environmentItem, "Boolean");
      case "string":
	return makeValueDescription(environmentItem, "String");
      case "number":
	return makeValueDescription(environmentItem, "Number");
      case "function":
	return makeValueDescription(environmentItem);
      case "object":
	return describeObject(environmentItem);
    }
  };

  return values.filter(item => !(item.name === "exports" || item.name === "require" || item.name === "module"
			         || item.name === "__filename" || item.name === "__dirname"))
               .reduce((description, item) => {
    return (value => `${description}${value.type} ${value.name}${value.value ? ": " + value.value : ""}\n`)(describeValue(item));
  }, "");
}

function scrollable(content, topLine) {
  return content.split("\n").slice(topLine).reduce((visibleContent, line) => {
    return `${visibleContent === "" ? visibleContent : visibleContent + "\n"}${line}`;
  }, "");
}

function writeTree(visitedSourceTree) {
  const formatEntry = entry => {
    return (entryName(entry) === selectedEntryLeafName(selectedEntry(visitedSourceTree))
      ? entryName => `\u001b[7m${entryName}\u001b[0m`
      : entryName => entryName)(
        (isDirectoryEntry(entry) ? entryName => colourText(entryName, "cyan")
	                         : entryName => entryName)(
          entryName(entry)));
  };

  return (selectedEntryBranchName(selectedEntry(visitedSourceTree)) === "" 
    ? `${colourText("root", "blue")}\n`
    : `${colourText(selectedEntryBranchName(selectedEntry(visitedSourceTree)), "blue")}\n`) 
    + selectedBranch(visitedSourceTree).map(entry => `  ${formatEntry(entry)}\n`).join("");
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

function exploreSourceTree(selectionInSourceTree, stream, continuation, onFilePicked) {
  if (isSourceTree(message(stream))) {
    return continuation(refreshSelectedSourceTree(selectionInSourceTree, readSourceTree(message(stream))));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === "j") {
    return continuation(selectNext(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === "k") {
    return continuation(selectPrevious(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === "l") {
    return continuation(visitChildBranch(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === "h") {
    return continuation(visitParentBranch(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream))
	     && sourceTreeFocusInput(message(stream)) === "\r"
	     && isFileSelected(selectedEntry(selectionInSourceTree))) {
    return onFilePicked(selectionInSourceTree);
  }
  else {
    return continuation(selectionInSourceTree);
  }
}

function displayedScriptSource() {
  const displayUpdater = (selectionInSourceTree, scriptId) => (continuation, onDisplayChange) => stream => {
    if (isDebuggerPaused(message(stream))) {
      const currentScriptId = scriptHandle(pauseLocation(message(stream)));

      if (scriptId !== currentScriptId) {
        return onDisplayChange(displayUpdater(selectionInSourceTree, currentScriptId), currentScriptId);
      }
      else {
        return continuation(displayUpdater(selectionInSourceTree, currentScriptId), currentScriptId);
      }
    }
    else {
      const selectionChange = selectionInSourceTree => {
        return continuation(displayUpdater(selectionInSourceTree, scriptId), scriptId);
      };

      const displayChange = selectionInSourceTree => {
	const scriptId = selectedEntryHandle(selectedEntry(selectionInSourceTree));

        return onDisplayChange(displayUpdater(selectionInSourceTree, scriptId), scriptId);
      };
      
      return exploreSourceTree(selectionInSourceTree, stream, selectionChange, displayChange);
    }
  };

  return displayUpdater(makeSelectionInSourceTree(makeSourceTree()), undefined);
}

module.exports = {
  describeEnvironment,
  displayedScriptSource,
  exploreSourceTree,
  isCtrlC,
  parseUserInput,
  scrollable,
  writeTree
};
