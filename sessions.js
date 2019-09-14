const { parseOneLine, isMethod, isResult, isInput, data } = require('./messages.js');
const { now, later, value, continuation, commit, forget, IO } = require('streamer');
const { emptyList, cons, atom, compose, show, row, vindent, sizeWidth, inline } = require('terminal');

function debugSession(send, render) {
  return async (stream) => {
    return loop(await IO(show, render)
	         (compose(developerSession, scriptSource, currentEvent, IO(commandLine, send)))
	           (await IO(pullEnvironment, send)(await IO(pullScriptSource, send)(stream))));
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

      send("Runtime.getProperties", {objectId: 1});

      return commit(stream, environmentChecker);
    }
    else {
      return commit(stream, environmentChecker);
    }
  };

  return environmentChecker;
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

function currentEvent(predecessor) {
  return stream => {
    if (isMethod(data(value(now(stream))), "Debugger.paused")) {
      return () => `${predecessor ? predecessor() : ""} \n` + data(value(now(stream))).params.callFrames[0].scopeChain[0].object.objectId.toString();
    }
    else if (isInput(data(value(now(stream))))) {
      return () => `${predecessor ? predecessor() : ""}`
    }
    else {
      return () => `${predecessor ? predecessor() : ""} \n` + JSON.stringify(data(value(now(stream))));
    }
  }
}

function commandLine(send) {
  return predecessor => stream => {
    if (isInput(data(value(now(stream))))) {
      if (predecessor() === "Enter command") {
        return () => data(value(now(stream))).input;
      }
      else if (data(value(now(stream))).input === "\x7f") { // If backspace is delete
        return () => predecessor().slice(0, -1);
      }
      else if (data(value(now(stream))).input === "\r") {
        send(...parseOneLine(predecessor()));

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

function developerSession(f, g, h) {
  return cons(inline(cons(sizeWidth(50, atom(f)), cons(sizeWidth(50, atom(g)), row(90)))),
              cons(cons(atom(h), vindent(90, row(10))), emptyList()));
}

async function loop(stream) {
  return loop(await continuation(now(stream))(forget(await later(stream))));
}

module.exports = { debugSession };
