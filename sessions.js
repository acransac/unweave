const { parseOneLine, isMethod, isResult, isInput, data } = require('./messages.js');
const { now, later, value, continuation, commit, forget, IO } = require('streamer');
const { emptyList, cons, atom, compose, show, column, row, indent, vindent, sizeHeight, sizeWidth, inline } = require('terminal');

function debugSession(send, render) {
  return async (stream) => {
    return loop(await IO(show, render)
	         (compose(developerSession, scriptSource, runLocation, environment, messages, commandLine))
	           (await IO(queryInspector, send)(await IO(pullEnvironment, send)(await IO(pullScriptSource, send)(stream)))));
    };
}

function DEBUG(f, g, h) {
  return `${f} : ${g} : ${h}`;
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
  const requester = query => async (stream) => {
    if (isInput(data(value(now(stream))))) {
      if (data(value(now(stream))).input === "\x7f") { // If backspace is delete
        return commit(stream, requester(query.slice(0, -1)));
      }
      else if (data(value(now(stream))).input === "\r") {
        send(...parseOneLine(query));

        return commit(stream, requester(""));
      }
      else {
        return commit(stream, requester(`${query}${data(value(now(stream))).input}`));
      }
    }
    else {
      return commit(stream, requester(query));
    }
  };

  return requester("");
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
    if (isInput(data(value(now(stream))))) {
      if (predecessor() === "Enter command") {
        return () => data(value(now(stream))).input;
      }
      else if (data(value(now(stream))).input === "\x7f") { // If backspace is delete
        return () => predecessor().slice(0, -1);
      }
      else if (data(value(now(stream))).input === "\r") {
        return () => "Enter command";
      }
      else {
        return () => `${predecessor()}${data(value(now(stream))).input}`;
      }
    }
    else {
      return predecessor ? predecessor : () => "Enter command";
    }
  }
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

function scriptSourceWithLocation(scriptSource, lineNumber) {
  return `${scriptSource}\n${lineNumber === undefined ? "Waiting for location" : lineNumber}`;
}

function developerSession(source, line, environment, messages, command) {
  //return cons(inline(cons(sizeWidth(50, atom(f)), cons(sizeWidth(50, atom(g)), row(90)))),
              //cons(cons(atom(h), vindent(90, row(10))), emptyList()));

  return cons(cons(sizeWidth(50, atom(scriptSourceWithLocation(source, line))), cons(cons(sizeHeight(50, atom(environment)), cons(vindent(50, sizeHeight(50, atom(messages))), indent(50, column(50)))), row(90))), cons(cons(atom(command), vindent(90, row(10))), emptyList()));
}

async function loop(stream) {
  return loop(await continuation(now(stream))(forget(await later(stream))));
}

module.exports = { debugSession };
