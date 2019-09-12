const EventEmitter = require('events');
const parseJsValue = require('./jsvalueparser.js');
const Readline = require('readline');
const { Source, now, later, value, continuation, floatOn, commit, forget, IO } = require('streamer');
const { renderer, compose, show, cons, emptyList, atom, row, sizeHeight, sizeWidth, indent, vindent, inline } = require('terminal');
const WebSocket = require('ws');

class MergedEventEmitters extends EventEmitter {
  constructor(emitters) {
    super();

    emitters.forEach(emitter => emitter[0].on(emitter[1], (event) => this.emit('event', event)));

    this.onevent = (event) => {};

    this.on('event', (event) => this.onevent(event));
  }
};

connectToInspector(process.argv[2]);

function connectToInspector(sessionHash) {
  const webSocket = new WebSocket(`ws://localhost:9230/${sessionHash}`);

  webSocket.onopen = () => startDebugSession(webSocket);

  webSocket.onerror = (error) => console.log(error);
}

function startDebugSession(webSocket) {
  console.log("Connection opened");

  const send = (methodName, parameters) => webSocket.send(JSON.stringify({method: methodName, params: parameters, id: 0}));

  const render = renderer();
  //const render = (message) => console.log(message);

  Source.from(mergeEvents([[inputCapture(), "input"], [webSocket, "message"]]), "onevent")
	.withDownstream(async (stream) => debugSession(send, render)(await IO(runProgram, send)(await IO(enableDebugger, send)(await runtimeEnabled(stream)))));

  enableRuntime(send);
}

function enableRuntime(send) {
  send("Runtime.enable", {});

  return runtimeEnabled;
}

async function runtimeEnabled(stream) {
  if (isMethod(data(value(now(stream))), "Runtime.executionContextCreated")) {
    return stream;
  }
  else {
    return runtimeEnabled(await later(stream));
  }
}

function enableDebugger(send) {
  send("Debugger.enable", {});

  return debuggerEnabled;
}

async function debuggerEnabled(stream) {
  if (isResult(data(value(now(stream))), "debuggerId")) {
    return stream;
  }
  else {
    return debuggerEnabled(await later(stream));
  }
}

function runProgram(send) {
  send("Runtime.runIfWaitingForDebugger", {});

  return programStarted;
}

async function programStarted(stream) {
  if (isMethod(data(value(now(stream))), "Debugger.paused")) {
    return stream;
  }
  else {
    return programStarted(await later(stream));
  }
}

function debugSession(send, render) {
  return async (stream) => {
    return loop(await IO(show, render)
	         (compose(developerSession, scriptSource, currentEvent, IO(commandLine, send)))
	           (await IO(pullScriptSource, send)(stream)));
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
      return () => "Method: Debugger.paused";
    }
    else {
      return () => JSON.stringify(data(value(now(stream))));
    }
  }
}

function commandLine(send) {
  return predecessor => stream => {
    if (isInput(data(value(now(stream))))) {
      if (predecessor() === "Enter command") {
        return () => data(value(now(stream))).input;
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

function inputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

  process.stdin.on('keypress', (key) => process.stdin.emit('input', JSON.stringify({input: key})));

  return process.stdin;
}

function mergeEvents(emitters) {
  return new MergedEventEmitters(emitters);
}

function data(message) {
  return JSON.parse(message);
}

function isMethod(message, methodName) {
  if (message.method) {
    return message.method === methodName;
  }
  else {
    return false;
  }
}

function isResult(message, resultName) {
  if (message.result) {
    return message.result.hasOwnProperty(resultName);
  }
  else {
    return false;
  }
}

function isInput(message) {
  return message.hasOwnProperty("input");
}

function parseOneLine(line) {
  let method, parameters;
  [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}
