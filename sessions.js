const { parseOneLine, isMethod, isResult, isInput, isBreakpointCapture, isQueryCapture, data } = require('./messages.js');
const { now, later, value, continuation, floatOn, commit, forget, IO } = require('streamer');
const { emptyList, cons, atom, compose, show, column, row, indent, vindent, sizeHeight, sizeWidth, inline } = require('terminal');

function debugSession(send, render) {
  return async (stream) => {
    return loop(await IO(show, render)
	         (compose(developerSession,
			  scriptSource,
			  runLocation,
			  scriptSourceWindowTopAnchor,
			  environment,
			  messages,
			  commandLine))
	           (await IO(step, send)
	             (await IO(queryInspector, send)
		       (await IO(addBreakpoint, send)
		         (await IO(pullEnvironment, send)
		           (await IO(pullScriptSource, send)
		  	     (await parseUserInput(stream))))))));
    };
}

function DEBUG(f, g, h, i, j) {
  return `${scriptSourceWithLocation(f, g)}\n${h}\n${i}\n${j}`;
}

async function parseUserInput(stream) {
  const modalCapture = (category, continuation) => {
    const parser = input => async (stream) => {
      if (isInput(data(value(now(stream))))) {
        if (data(value(now(stream))).input === "\x7f") { // If backspace is delete
          return floatOn(commit(stream, parser(input.slice(0, -1))), JSON.stringify(
	    Object.fromEntries([[category, input.slice(0, -1)], ["ended", false]])
	  ));
        }
        else if (data(value(now(stream))).input === "\r") {
          return floatOn(commit(stream, continuation), JSON.stringify(
	    Object.fromEntries([[category, input], ["ended", true]])
	  ));
        }
        else {
          return floatOn(commit(stream, parser(`${input}${data(value(now(stream))).input}`)), JSON.stringify(
	    Object.fromEntries([[category, `${input}${data(value(now(stream))).input}`], ["ended", false]])
	  ));
        }
      }
      else {
        return commit(stream, parser(input));
      }
    };

    return parser("");
  };

  if (isInput(data(value(now(stream))))) {
    if (data(value(now(stream))).input === "q") {
      return floatOn(commit(stream, modalCapture("query", parseUserInput)), JSON.stringify({query: ""}));
    }
    else if (data(value(now(stream))).input === "b") {
      return floatOn(commit(stream, modalCapture("breakpoint", parseUserInput)), JSON.stringify({breakpoint: ""}));
    }
    else {
      return commit(stream, parseUserInput);
    }
  }
  else {
    return commit(stream, parseUserInput);
  }
}

function pullScriptSource(send) {
  const scriptChecker = scriptId => async (stream) => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      const currentScriptId = data(value(now(stream))).params.callFrames[0].location.scriptId;

      if (scriptId !== currentScriptId) {
        send("Debugger.getScriptSource", {scriptId: currentScriptId});
      }

      return commit(stream, scriptChecker(currentScriptId));
    }
    else {
      return commit(stream, scriptChecker(scriptId));
    }
  }

  return scriptChecker(undefined);
}

function pullEnvironment(send) {
  const environmentChecker = async (stream) => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      const environmentRemoteObject = data(value(now(stream))).params.callFrames[0].scopeChain[0].object.objectId;

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
    if (isQueryCapture(data(value(now(stream)))) && data(value(now(stream))).ended) {
      send(...parseOneLine(data(value(now(stream))).query));

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
    if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "n") {
      send("Debugger.stepOver", {});
    }
    else if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "s") {
      send("Debugger.stepInto", {});
    }
    else if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "c") {
      send("Debugger.resume", {});
    }
    else if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "f") {
      send("Debugger.stepOut", {});
    }

    return commit(stream, stepper);
  };

  return stepper;
}

function addBreakpoint(send) {
  const breakpointSetter = scriptId => async (stream) => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      return commit(stream, breakpointSetter(data(value(now(stream))).params.callFrames[0].location.scriptId));
    }
    else if (isBreakpointCapture(data(value(now(stream)))) && data(value(now(stream))).ended) {
      send("Debugger.setBreakpoint", {location: {scriptId: scriptId, lineNumber: Number(data(value(now(stream))).breakpoint)}});

      return commit(stream, breakpointSetter(scriptId));
    }
    else {
      return commit(stream, breakpointSetter(scriptId));
    }
  };

  return breakpointSetter(undefined);
}

function scriptSource(predecessor) {
  return stream => {
    if (isResult(data(value(now(stream))), "scriptSource")) {
      return () => data(value(now(stream))).result.scriptSource;
    }
    else {
      return predecessor ? predecessor : () => "Loading script source";
    }
  }
}

function scriptSourceWindowTopAnchor(predecessor) {
  return stream => {
    if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "j") {
      return () => { return {scriptId: predecessor().scriptId, topLine: predecessor().topLine + 1}; };
    }
    else if (isInput(data(value(now(stream)))) && data(value(now(stream))).input === "k") {
      return () => { return {scriptId: predecessor().scriptId, topLine: predecessor().topLine - 1}; };
    }
    else if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      const currentLocation = data(value(now(stream))).params.callFrames[0].location;

      if (!predecessor || currentLocation.scriptId !== predecessor().scriptId) {
        return () => { return {scriptId: currentLocation.scriptId, topLine: Math.max(currentLocation.lineNumber - 3, 0)}; }
      }
      else {
        return predecessor;
      }
    }
    else {
      return predecessor ? predecessor : () => { return {scriptId: undefined, topLine: 0}; };
    }
  };
}

function runLocation(predecessor) {
  return stream => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      return () => data(value(now(stream))).params.callFrames[0].location.lineNumber;
    }
    else {
      return predecessor ? predecessor : () => undefined;
    }
  };
}

function environment(predecessor) {
  return stream => {
    if (isResult(data(value(now(stream))), "result")) {
      return () => describeEnvironment(data(value(now(stream))).result.result);
    }
    else {
      return predecessor ? predecessor : () => "Loading environment";
    }
  }
}

function commandLine(predecessor) {
  return stream => {
    if (isBreakpointCapture(data(value(now(stream))))) {
      return data(value(now(stream))).ended ? () => "q: Query Inspector  b: Add breakpoint  n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up"
	                                    : () => `Add breakpoint at line: ${data(value(now(stream))).breakpoint}`;
    }
    else if (isQueryCapture(data(value(now(stream))))) {
      return data(value(now(stream))).ended ? () => "q: Query Inspector  b: Add breakpoint  n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up"
	                                    : () => `Query Inspector: ${data(value(now(stream))).query}`;
    }
    else {
      return predecessor ? predecessor : () => "q: Query Inspector  b: Add breakpoint  n: Step over  s: Step into  f: Step out  c: Continue  j: Scroll down  k: Scroll up";
    }
  };
}

function messages(predecessor) {
  return stream => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      return () => `${Object.entries(data(value(now(stream))).params.callFrames[0].location)}`;
    }
    else {
      return predecessor ? predecessor : () => "Waiting";
    }
  };
}

function describeEnvironment(values) {
  return values.filter(item => !(item.name === "exports" || item.name === "require" || item.name === "module"
			               || item.name === "__filename" || item.name === "__dirname"))
               .reduce((description, item) => {
    return `${description}${item.value.type} ${item.name}${item.value  === "undefined" ? "" : ": " + item.value.value}\n`;
  }, "");
}

function scriptSourceWithLocation(scriptSource, lineNumber, scriptSourceWindowTopAnchor) {
  return scriptSource.split("\n")
		     .map((line, lineId) => ` ${lineId === lineNumber ? "> " + line : "  " + line}`)
	             .slice(scriptSourceWindowTopAnchor.topLine)
	             .reduce((formattedVisibleSource, line) =>
		       `${formattedVisibleSource === "" ? formattedVisibleSource : formattedVisibleSource + "\n"}${line}`,
			"");
}

function developerSession(source, line, sourceWindowTopAnchor, environment, messages, command) {
  return cons
	   (cons
	     (sizeWidth(50, atom(scriptSourceWithLocation(source, line, sourceWindowTopAnchor))),
	      cons
	        (cons
	          (sizeHeight(50, atom(environment)),
	           cons
	             (vindent(50, sizeHeight(50, atom(messages))),
		     indent(50, column(50)))),
		 row(90))),
	    cons
	      (cons
	        (atom(command),
 		 vindent(90, row(10))),
	       emptyList()));
}

async function loop(stream) {
  return loop(await continuation(now(stream))(forget(await later(stream))));
}

module.exports = { debugSession };
