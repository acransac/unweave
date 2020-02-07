const { entryValue, hasEnded, isDebuggerPaused, isSourceTree, isSourceTreeFocus, message, name, pauseLocation, readSourceTree, scriptHandle, sourceTreeFocusInput, type } = require('./protocol.js');
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

function describeEnvironment(entries) {
  return entries.filter(entry => !(name(entry) === "exports" || name(entry) === "require" || name(entry) === "module"
			           || name(entry) === "__filename" || name(entry) === "__dirname"))
               .reduce((description, entry) => {
    return `${description}${type(entry)} ${name(entry)}${entryValue(entry) ? ": " + entryValue(entry) : ""}\n`;
  }, "");
}

function makeDisplayedContent(content, topLine) {
  return [content, topLine ? topLine : 0];
}

function content(displayedContent) {
  return displayedContent[0];
}

function topLine(displayedContent) {
  return displayedContent[1];
}

function scrollable(isInput, input) {
  return (displayedContent, stream) => {
    if (isInput(message(stream)) && input(message(stream)) === "j") {
      return makeDisplayedContent(content(displayedContent),
                                  Math.min(content(displayedContent).split("\n").length - 1,
					   topLine(displayedContent) + 1));
    }
    else if (isInput(message(stream)) && input(message(stream)) === "k") {
      return makeDisplayedContent(content(displayedContent), Math.max(0, topLine(displayedContent) - 1));
    }
    else {
      return displayedContent;
    }
  };
}

function scrollableContent(displayedContent) {
  return content(displayedContent).split("\n").slice(topLine(displayedContent)).reduce((visibleContent, line) => {
    return `${visibleContent === "" ? visibleContent : visibleContent + "\n"}${line}`;
  }, "");
}

function writeTree(visitedSourceTree) {
  const formatEntry = entry => {
    return (entryName(entry) === selectedEntryLeafName(selectedEntry(visitedSourceTree))
      ? entryName => `\u001b[7m${entryName}\u001b[0m`
      : entryName => entryName)(
        (isDirectoryEntry(entry) ? entryName => styleText(entryName, "bold")
	                         : entryName => entryName)(
          entryName(entry)));
  };

  return (selectedEntryBranchName(selectedEntry(visitedSourceTree)) === "" 
    ? `${styleText("root", "bold")}\n`
    : `${styleText(selectedEntryBranchName(selectedEntry(visitedSourceTree)), "bold")}\n`) 
    + selectedBranch(visitedSourceTree).map(entry => `  ${formatEntry(entry)}\n`).join("");
}

function styleText(text, style) {
  switch (style) {
    case 'black': return `\u001b[30m${text}\u001b[0m`;
    case 'red': return `\u001b[31m${text}\u001b[0m`;
    case 'green': return `\u001b[32m${text}\u001b[0m`;
    case 'yellow': return `\u001b[33m${text}\u001b[0m`;
    case 'blue': return `\u001b[34m${text}\u001b[0m`;
    case 'magenta': return `\u001b[35m${text}\u001b[0m`;
    case 'cyan': return `\u001b[36m${text}\u001b[0m`;
    case 'white': return `\u001b[37m${text}\u001b[0m`;
    case 'bold': return `\u001b[1m${text}\u001b[0m`;
    case 'reversed': return `\u001b[7m${text}\u001b[0m`;
    case 'underline': return `\u001b[4m${text}\u001b[0m`;
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

function makePackagedContent(tag, content) {
  return [tag, content];
}

function tag(packagedContent) {
  return packagedContent[0];
}

function unpackedContent(packagedContent) {
  return packagedContent[1];
}

function focusableImpl(onFocus, onLoseFocus, alwaysHighlightedCharacter) {
  return (text, stream) => {
    const clearText = text => text.replace("\u001b[1m", "").replace("\u001b[0m", "");

    if (onFocus(message(stream))) {
      return styleText(clearText(text), "bold");
    }
    else if (onLoseFocus(message(stream))) {
      return highlightOneCharacter(clearText(text), alwaysHighlightedCharacter ? alwaysHighlightedCharacter : "");
    }
    else {
      return text;
    }
  };
}

function focusable(isFocus, alwaysHighlightedCharacter) {
  return focusableImpl(message => isFocus(message) && !hasEnded(message),
	               message => isFocus(message) && hasEnded(message),
	               alwaysHighlightedCharacter);
}

function focusableByDefault(isNotFocus, alwaysHighlightedCharacter) {
  return focusableImpl(message => isNotFocus(message) && hasEnded(message),
	               message => isNotFocus(message) && !hasEnded(message),
	               alwaysHighlightedCharacter);
}

function highlightOneCharacter(text, character) {
  const highlightCharacter = (processedText, originalText) => {
    if (originalText.length === 0) {
      return processedText;
    }
    else if (originalText[0] === character) {
      return `${processedText}${styleText(originalText[0], "bold")}${originalText.slice(1)}`;
    }
    else {
      return highlightCharacter(`${processedText}${originalText[0]}`, originalText.slice(1));
    }
  };

  if (character === "") {
    return text;
  }
  else {
    return highlightCharacter("", text);
  }
}

function tabs(number, ...packagedContents) {
  return packagedContents.map((packagedContent, index) => {
    return (index === number ? label => `>${label}<` : label => label)(tag(packagedContent));
  })
	                 .join("-");
}

module.exports = {
  content,
  describeEnvironment,
  displayedScriptSource,
  exploreSourceTree,
  focusable,
  focusableByDefault,
  highlightOneCharacter,
  isCtrlC,
  makeDisplayedContent,
  makePackagedContent,
  parseUserInput,
  scrollable,
  scrollableContent,
  styleText,
  tabs,
  tag,
  topLine,
  unpackedContent,
  writeTree
};
