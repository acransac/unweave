const { displayedScriptSource, parseUserInput } = require('./helpers.js');
const { isBreakpointCapture, isInput, isMethod, isQueryCapture, message, parseInspectorQuery } = require('./protocol.js');
const { insertInSourceTree, parseFilePath } = require('./sourceTreeParser.js');
const { commit, floatOn } = require('streamer');

async function changeMode(stream) {
  const modalCapture = (category, continuation) => {
    const modeSetter = async (stream) => {
      if (isInput(message(stream))) {
        if (message(stream).input === "\r") {
          return floatOn(commit(stream, continuation), JSON.stringify(
	    Object.fromEntries([[category, message(stream).input], ["ended", true]])
	  ));
        }
        else {
          return floatOn(commit(stream, modeSetter), JSON.stringify(
	    Object.fromEntries([[category, message(stream).input], ["ended", false]])
	  ));
        }
      }
      else {
        return commit(stream, modeSetter);
      }
    };

    return modeSetter;
  };

  if (isInput(message(stream))) {
    if (message(stream).input === "q") {
      return floatOn(commit(stream, modalCapture("query", changeMode)),
	             JSON.stringify({query: "", ended: false}));
    }
    else if (message(stream).input === "b") {
      return floatOn(commit(stream, modalCapture("breakpoint", changeMode)),
	             JSON.stringify({breakpoint: "", ended: false}));
    }
    else if (message(stream).input === "m") {
      return floatOn(commit(stream, modalCapture("focusMessages", changeMode)),
	             JSON.stringify({focusMessages: "", ended: false}));
    }
    else if (message(stream).input === "w") {
      return floatOn(commit(stream, modalCapture("focusSourceTree", changeMode)),
	             JSON.stringify({focusSourceTree: "", ended: false}));
    }
    else {
      return commit(stream, changeMode);
    }
  }
  else {
    return commit(stream, changeMode);
  }
}

function parseCaptures() {
  const parser = capture => async (stream) => {
    if (isBreakpointCapture(message(stream))) {
      if (message(stream).ended) {
        return floatOn(commit(stream, parser("")), JSON.stringify({breakpoint: capture, ended: true}));
      }
      else {
	const newCapture = parseUserInput(capture, message(stream).breakpoint);

        return floatOn(commit(stream, parser(newCapture)), JSON.stringify({breakpoint: newCapture, ended: false}));
      }
    }
    else if (isQueryCapture(message(stream))) {
      if (message(stream).ended) {
        return floatOn(commit(stream, parser("")), JSON.stringify({query: capture, ended: true}));
      }
      else {
	const newCapture = parseUserInput(capture, message(stream).query);

        return floatOn(commit(stream, parser(newCapture)), JSON.stringify({query: newCapture, ended: false}));
      }
    }
    else {
      return commit(stream, parser(capture));
    }
  };

  return parser("");
}

function parseSourceTree() {
  const builder = sourceTree => async (stream) => {
    if (isMethod(message(stream), "Debugger.scriptParsed")
	  && message(stream).params.url.startsWith("file://")) {
      const [path, fileName] = parseFilePath(message(stream).params.url.slice("file://".length));

      const newSourceTree = insertInSourceTree({root: sourceTree.root ? sourceTree.root : path, branches: sourceTree.branches},
	                                       path,
	                                       {name: fileName, id: message(stream).params.scriptId});

      return floatOn(commit(stream, builder(newSourceTree)),
	             JSON.stringify({sourceTree: {root: newSourceTree.root, branches: newSourceTree.branches}}));
    }
    else {
      return commit(stream, builder(sourceTree));
    }
  };

  return builder({root: undefined, branches: []});
}

function pullScriptSource(send) {
  const scriptChecker = displayChange => async (stream) => {
    const onDisplayChange = (displayChange, newDisplayScriptId) => {
      send("Debugger.getScriptSource", {scriptId: newDisplayScriptId});

      return commit(stream, scriptChecker(displayChange));
    };

    const onSelectionChange = (displayChange, scriptId) => {
      return commit(stream, scriptChecker(displayChange));
    };
	  
    return displayChange(onSelectionChange, onDisplayChange)(stream);
  };

  return scriptChecker(displayedScriptSource());
}

function pullEnvironment(send) {
  const environmentChecker = async (stream) => {
    if (isMethod(message(stream), "Debugger.paused")) {
      const environmentRemoteObject = message(stream).params.callFrames[0].scopeChain[0].object.objectId;

      send("Runtime.getProperties", {objectId: environmentRemoteObject});

      return commit(stream, environmentChecker);
    }
    else {
      return commit(stream, environmentChecker);
    }
  };

  return environmentChecker;
}

function queryInspector(send) {
  const requester = async (stream) => {
    if (isQueryCapture(message(stream)) && message(stream).ended) {
      send(...parseInspectorQuery(message(stream).query));

      return commit(stream, requester);
    }
    else {
      return commit(stream, requester);
    }
  };

  return requester;
}

function step(send) {
  const stepper = async (stream) => {
    if (isInput(message(stream)) && message(stream).input === "n") {
      send("Debugger.stepOver", {});
    }
    else if (isInput(message(stream)) && message(stream).input === "s") {
      send("Debugger.stepInto", {});
    }
    else if (isInput(message(stream)) && message(stream).input === "c") {
      send("Debugger.resume", {});
    }
    else if (isInput(message(stream)) && message(stream).input === "f") {
      send("Debugger.stepOut", {});
    }

    return commit(stream, stepper);
  };

  return stepper;
}

function addBreakpoint(send) {
  const breakpointSetter = scriptId => breakpointLine => {
    send("Debugger.setBreakpoint", {location: {scriptId: scriptId, lineNumber: breakpointLine}});
  };

  const breakpointAdder = (setBreakpoint, displayChange) => async (stream) => {
    const updateBreakpointSetter = (displayChange, scriptId) => {
      return commit(stream, breakpointAdder(breakpointSetter(scriptId), displayChange));
    };

    if (isBreakpointCapture(message(stream)) && message(stream).ended) {
      setBreakpoint(Number(message(stream).breakpoint));

      return commit(stream, breakpointAdder(setBreakpoint, displayChange));
    }
    else {
      return displayChange(updateBreakpointSetter, updateBreakpointSetter)(stream);
    }
  };

  return breakpointAdder(breakpointSetter(undefined), displayedScriptSource());
}

module.exports = { addBreakpoint, changeMode, parseCaptures, parseSourceTree, pullEnvironment, pullScriptSource, queryInspector, step };
