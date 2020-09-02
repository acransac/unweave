// Copyright (c) Adrien Cransac
// License: MIT

const { deferredEntryLeafName, registerPendingEntry, selectedEnvironmentEntryBranchName, selectedEnvironmentEntryLeafName, selectNextEntry, selectPreviousEntry, visitChildEntry, visitChildEntrySilently, visitParentEntry } = require('./environmenttree.js');
const { entryName, isDirectoryEntry, isFileSelected, makeSelectionInFileTree, makeFileTree, refreshSelectedFileTree, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectNext, selectPrevious, visitChildBranch, visitParentBranch } = require('@acransac/filetree');
const { columnNumber, entryValue, environmentTreeFocusInput, hasEnded, interactionKeys, isDebuggerPaused, isEnvironmentTreeFocus, isSourceTree, isSourceTreeFocus, lineNumber, message, name, pauseLocation, readSourceTree, scriptHandle, sourceTreeFocusInput, type } = require('./protocol.js');

// # Focusable Behaviour

/*
 * Highlight an atom's label when it is focused on, and highlight only the focus key when it is not
 * @param {function} isFocus - A function that checks if the current message triggers the focus or terminates it
 * @param {string} alwaysHighlightedCharacter - A character present in the label and that is always highlighted to indicate the focus key
 * @return {function} - A function taking the current label and the stream as arguments. It updates the formatting of the label depending on the focus state
 */
function focusable(isFocus, alwaysHighlightedCharacter) {
  return focusableImpl(message => isFocus(message) && !hasEnded(message),
                       message => isFocus(message) && hasEnded(message),
                       alwaysHighlightedCharacter);
}

/*
 * Highlight an atom's label when no focus is active to indicate it is the default mode. Otherwise, it is not highlighted
 * @param {function} isNotFocus - A function that checks if the current message triggers a focus on another display or terminates it
 * @param {string} alwaysHighlightedCharacter - Not used, this argument should be deleted
 * @return {function} - A function taking the current label and the stream as arguments. It updates the formatting of the label depending on the focus state
 */
function focusableByDefault(isNotFocus, alwaysHighlightedCharacter) {
  return focusableImpl(message => isNotFocus(message) && hasEnded(message),
                       message => isNotFocus(message) && !hasEnded(message),
                       alwaysHighlightedCharacter);
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

/*
 * Highlight the first iteration of a character in a text
 * @param {string} text - Some text
 * @param {string} character - The character to find and highlight
 * @return {string}
 */
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

/*
 * Write tab titles in the label of an atom, emphasizing one that is the active one
 * @param {number} number - The index from 0 of the active tab
 * @param {...PackagedContent} packagedContents - The packaged contents corresponding to the tabs
 * @return {string} - The sequence of titles that is to be used as the label of the host atom
 */
function tabs(number, ...packagedContents) {
  return packagedContents.map((packagedContent, index) => {
    return (index === number ? label => `>${label}<` : label => label)(tag(packagedContent));
  })
                         .join("-");
}

// ## Packaged Content
// A packaged content associates a label with some content

/*
 * Package some content
 * @param {string} tag - The label of the content
 * @param {*} content - Some content
 * @return {PackagedContent}
 */
function makePackagedContent(tag, content) {
  return [tag, content];
}

/*
 * Get the label of the packaged content
 * @param {PackagedContent} packagedContent - Some packaged content
 * @return {string}
 */
function tag(packagedContent) {
  return packagedContent[0];
}

/*
 * Get the content that is packaged
 * @param {PackagedContent} packagedContent - Some packaged content
 * @return {*}
 */
function unpackedContent(packagedContent) {
  return packagedContent[1];
}

// # Scrollable Behaviour

/*
 * Scroll the view over some displayed content
 * @param {function} isInput - A function that checks if the current message carries user input
 * @param {function} input - A function that reads the user input from the current message
 * @return {function} - A function that receives some displayed content and the stream and updates the view over the displayed content
 */
function scrollable(isInput, input) {
  return (displayedContent, stream) => {
    if (isInput(message(stream)) && input(message(stream)) === interactionKeys("scrollDown")) {
      return makeDisplayedContent(content(displayedContent),
                                  Math.min(content(displayedContent).split("\n").length - 1,
                                           topLine(displayedContent) + 1));
    }
    else if (isInput(message(stream)) && input(message(stream)) === interactionKeys("scrollUp")) {
      return makeDisplayedContent(content(displayedContent), Math.max(0, topLine(displayedContent) - 1));
    }
    else {
      return displayedContent;
    }
  };
}

/*
 * Extracts the visible content from some displayed content
 * @param {DisplayedContent} displayedContent - Some displayed content
 * @return {string}
 */
function scrollableContent(displayedContent) {
  return content(displayedContent).split("\n").slice(topLine(displayedContent)).reduce((visibleContent, line) => {
    return `${visibleContent === "" ? visibleContent : visibleContent + "\n"}${line}`;
  }, "");
}

// ## Displayed Content
// A displayed content is a view over some long textual content defined by the starting line of the viewable part.

/*
 * Make some displayed content
 * @param {string} content - Some textual content
 * @param {number} [topLine: 0] - The start of the view over the content as a line number counted from 0
 * @return {DisplayedContent}
 */
function makeDisplayedContent(content, topLine) {
  return [content, topLine ? topLine : 0];
}

/*
 * Get the full content
 * @param {DisplayedContent} displayedContent - Some displayed content
 * @return {string}
 */
function content(displayedContent) {
  return displayedContent[0];
}

/*
 * Get the starting line of the view over the content
 * @param {DisplayedContent} displayedContent - Some displayed content
 * @return {number}
 */
function topLine(displayedContent) {
  return displayedContent[1];
}

// # Text Formatter

/*
 * Colour or decorate some text
 * @param {string} text - Some text
 * @param {string} style - The name of the colour or decoration, such as bold, reversed or underline
 * @return {string}
 */
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

// # Tree Explorers
// ## Environment Tree Explorers

/*
 * Update the selection in the environment tree, query deferred entries if necessary and update the pending entries register
 * @param {EnvironmentTree.Selection} selectionInEnvironmentTree - A selection in the environment tree
 * @param {PendingEntriesRegister} pendingEntriesRegister - The pending entries register
 * @param {Stream} stream - The stream
 * @param {function} continuation - The function to execute afterwards, which receives the updated selection and pending entries register
 * @return {*} - Returns the result of the continuation
 */
function exploreEnvironmentTree(selectionInEnvironmentTree, pendingEntriesRegister, stream, continuation) {
  return (newSelection => continuation(newSelection, registerPendingEntry(pendingEntriesRegister, newSelection)))
           (exploreEnvironmentTreeImpl(visitChildEntry)(selectionInEnvironmentTree, stream));
}

function exploreEnvironmentTreeImpl(visitChildEntry) {
  return (selectionInEnvironmentTree, stream) => {
    if (isEnvironmentTreeFocus(message(stream))
          && environmentTreeFocusInput(message(stream)) === interactionKeys("selectNext")) {
      return selectNextEntry(selectionInEnvironmentTree);
    }
    else if (isEnvironmentTreeFocus(message(stream))
               && environmentTreeFocusInput(message(stream)) === interactionKeys("selectPrevious")) {
      return selectPreviousEntry(selectionInEnvironmentTree);
    }
    else if (isEnvironmentTreeFocus(message(stream))
               && environmentTreeFocusInput(message(stream)) === interactionKeys("selectChild")) {
      return visitChildEntry(selectionInEnvironmentTree);
    }
    else if (isEnvironmentTreeFocus(message(stream))
               && environmentTreeFocusInput(message(stream)) === interactionKeys("selectParent")) {
      return visitParentEntry(selectionInEnvironmentTree);
    }
    else {
      return selectionInEnvironmentTree;
    }
  };
}

/*
 * Update the selection in the environment tree but don't query deferred entries
 * @param {EnvironmentTree.Selection} selectionInEnvironmentTree - A selection in the environment tree
 * @param {Stream} stream - The stream
 * @param {function} continuation - The function to execute afterwards, which receives the updated selection
 * @return {*} - Returns the result of the continuation
 */
function exploreEnvironmentTreeSilently(selectionInEnvironmentTree, stream, continuation) {
  return continuation(exploreEnvironmentTreeImpl(visitChildEntrySilently)(selectionInEnvironmentTree, stream));
}

// ## Source Tree Explorers

/*
 * Update the selection in the source tree and the displayed script id
 * @return {function} - The display updater that tracks the source tree, its selection and the displayed script id and receives two user-defined callbacks. The first is called when the displayed script source hasn't been changed by processing the current message. The second is called when the displayed script changes. Both receive the next iteration of the display updater and the latest displayed script id as arguments. The stream has to be passed to the function returned by calling the display updater with the user-defined callbacks
 */
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

  return displayUpdater(makeSelectionInFileTree(makeFileTree()), undefined);
}

/*
 * Update the selection in the source tree
 * @param {FileTree.Selection} selectionInSourceTree - A selection in the source tree
 * @param {Stream} stream - The stream
 * @param {function} continuation - The function to execute afterwards when no file is picked and that receives the updated selection
 * @param {function} onFilePicked - The function to execute afterwards when a file is picked and that receives the updated selection
 * @return {*} - Returns the result of the continuation
 */
function exploreSourceTree(selectionInSourceTree, stream, continuation, onFilePicked) {
  if (isSourceTree(message(stream))) {
    return continuation(refreshSelectedFileTree(selectionInSourceTree, readSourceTree(message(stream))));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === interactionKeys("selectNext")) {
    return continuation(selectNext(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === interactionKeys("selectPrevious")) {
    return continuation(selectPrevious(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === interactionKeys("selectChild")) {
    return continuation(visitChildBranch(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream)) && sourceTreeFocusInput(message(stream)) === interactionKeys("selectParent")) {
    return continuation(visitParentBranch(selectionInSourceTree));
  }
  else if (isSourceTreeFocus(message(stream))
             && sourceTreeFocusInput(message(stream)) === enterInput()
             && isFileSelected(selectedEntry(selectionInSourceTree))) {
    return onFilePicked(selectionInSourceTree);
  }
  else {
    return continuation(selectionInSourceTree);
  }
}

// # User Input

/*
 * Get the platform dependent character code for backspace
 * return {string}
 */
function backspaceInput() {
  return "\x7f";
}

/*
 * Get the platform dependent character code for ctrl+c
 * return {string}
 */
function ctrlCInput() {
  return "\x03";
}

/*
 * Get the platform dependent character code for enter
 * return {string}
 */
function enterInput() {
  return "\r";
}

/*
 * Append a character to a previous sequence, removing the last entry when backspace is read and returning when enter is read. Used to parse user input
 * @param {string} parsed - The previously processed sequence of inputs
 * @param {string} currentInput - The last input received
 * @return {string}
 */
function parseUserInput(parsed, currentInput) {
  if (currentInput === backspaceInput()) {
    return parsed.slice(0, -1);
  }
  else if (currentInput === enterInput()) {
    return parsed;
  }
  else {
    return `${parsed}${currentInput}`;
  }
}

// # Writers
// ## Script Source Writer

/*
 * Write and format the visible part of a script source, marking the run location and breakpoints
 * @param {DisplayedContent} scriptSource - The raw script source as displayed content
 * @param {Location} runLocation - The current location of the run
 * @param {Location[]} breakpoints - An array of the breakpoint locations
 * @param {number} displayedScript - The id of the currently displayed script
 * @return {string}
 */
function writeScriptSource(scriptSource, runLocation, breakpoints, displayedScript) {
  const formatScriptSource = (formattedLines, breakpoints, originalLines, originalLineNumber) => {
    if (originalLines.length === 0) {
      return formattedLines;
    }
    else {
      const hasBreakpoint = !(breakpoints.length === 0) && lineNumber(breakpoints[0]) === originalLineNumber;

      const lineNumberPrefix = lineNumber => {
        if (lineNumber.toString().length < 4) {
          return `${lineNumber.toString().padEnd(3, ' ')}|`;
        }
        else {
          return `${lineNumber.toString()}|`;
        }
      };

      const runLocationHighlights = line => {
        const highlightCurrentExpression = line => {
          const highlightCurrentExpressionImpl = (beforeHighlight, line) => {
            const isOneOf = (characterSelection, character) => {
              if (characterSelection.length === 0) {
                return false;
              }
              else if (characterSelection[0] === character) {
                return true;
              }
              else {
                return isOneOf(characterSelection.slice(1), character);
              }
            };

            if (line.length === 0) {
              return beforeHighlight;
            }
            else if (isOneOf("[({ })]=>\r\n;", line[0])) {
              return highlightCurrentExpressionImpl(`${beforeHighlight}${line[0]}`, line.slice(1));
            }
            else {
              return (expression => `${beforeHighlight}${styleText(expression, "bold")}${line.slice(expression.length)}`)
                       (line.match(/^[a-zA-Z0-9\"\']+/g)[0]);
            }
          };

          return highlightCurrentExpressionImpl("", line);
        };

        if (scriptHandle(runLocation) === displayedScript && lineNumber(runLocation) === originalLineNumber) {
          return `> ${line.slice(0, columnNumber(runLocation))}${highlightCurrentExpression(line.slice(columnNumber(runLocation)))}`;
        }
        else {
          return `  ${line}`;
        }
      };

      return formatScriptSource([...formattedLines,`${lineNumberPrefix(originalLineNumber)}${hasBreakpoint ? "*" : " "}${runLocationHighlights(originalLines[0])}`],
                                hasBreakpoint ? breakpoints.slice(1) : breakpoints,
                                originalLines.slice(1),
                                originalLineNumber + 1);
    }
  };

  return scrollableContent(makeDisplayedContent(formatScriptSource([],
                                                                   breakpoints.filter(breakpoint => {
                                                                     return scriptHandle(breakpoint) === displayedScript;
                                                                   })
                                                                              .sort((breakpointA, breakpointB) => {
                                                                     return lineNumber(breakpointA) - lineNumber(breakpointB);
                                                                   }),
                                                                   content(scriptSource).split("\n"),
                                                                   0).join("\n"),
                                                topLine(scriptSource)));
}

// ## Tree Writers
function writeTreeImpl(visitedTree, filterBranch, branchName, leafName) {
  const formatEntry = entry => {
    return (entryName(entry) === (leafName ? leafName : selectedEntryLeafName)(selectedEntry(visitedTree))
      ? entryName => `\u001b[7m${entryName}\u001b[0m`
      : entryName => entryName)(
        (isDirectoryEntry(entry) ? entryName => styleText(entryName, "bold")
                                 : entryName => entryName)(
          entryName(entry)));
  };

  return ((branchName ? branchName : selectedEntryBranchName)(selectedEntry(visitedTree)) === ""
    ? `${styleText("root", "bold")}\n`
    : `${styleText((branchName ? branchName : selectedEntryBranchName)(selectedEntry(visitedTree)), "bold")}\n`)
    + selectedBranch(visitedTree).filter(entry => filterBranch ? filterBranch(entry) : true)
                                 .map(entry => `  ${formatEntry(entry)}\n`).join("");
}

// ### Environment Tree Writer

/*
 * Deprecated. Write for each entry in an environment message a description of the type and value, filtering out meta entries
 * @param {EnvironmentMessage.Entry[]} entries - An array of entries read in an environment message
 * @return {string}
 */
function describeEnvironment(entries) {
  return entries.filter(entry => !(name(entry) === "exports" || name(entry) === "require" || name(entry) === "module"
                                   || name(entry) === "__filename" || name(entry) === "__dirname"))
               .reduce((description, entry) => {
    return `${description}${type(entry)} ${name(entry)}${entryValue(entry) ? ": " + entryValue(entry) : ""}\n`;
  }, "");
}

/*
 * Write and format the description of the content of the active branch in a selected environment tree
 * @param {EnvironmentTree.Selection} visitedEnvironmentTree - A selection in the environment tree
 * @return {string}
 */
function writeEnvironmentTree(visitedEnvironmentTree) {
  return writeTreeImpl(visitedEnvironmentTree,
                       entry => entryName(entry) !== deferredEntryLeafName(),
                       selectedEnvironmentEntryBranchName,
                       selectedEnvironmentEntryLeafName);
}

// ### Source Tree Writer

/*
 * Write and format the description of the content of the active branch in a selected source tree
 * @param {FileTree.Selection} visitedSourceTree - A selection in the source tree
 * @return {string}
 */
function writeSourceTree(visitedSourceTree) {
  return writeTreeImpl(visitedSourceTree);
}

module.exports = {
  backspaceInput,
  content,
  ctrlCInput,
  describeEnvironment,
  displayedScriptSource,
  enterInput,
  exploreEnvironmentTree,
  exploreEnvironmentTreeSilently,
  exploreSourceTree,
  focusable,
  focusableByDefault,
  highlightOneCharacter,
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
  writeEnvironmentTree,
  writeScriptSource,
  writeSourceTree
};
