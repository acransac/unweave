const EventEmitter = require('events');
const parseJsValue = require('./jsvalueparser.js');
const Readline = require('readline');
const { Source, now, later, value, continuation, floatOn, commit, forget, IO } = require('streamer');
const { renderer, cons, emptyList, atom } = require('terminal');
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

  const render = (content) => console.log(content);

  //Source.from(mergeEvents([[inputCapture(), "keypress"], [webSocket, "message"]]), "onevent")
  Source.from(mergeEvents([[webSocket, "message"]]), "onevent")
	.withDownstream(async (stream) => TEST(send, render)(await IO(runProgram, send)(await IO(enableDebugger, send)(await runtimeEnabled(stream)))));

  enableRuntime(send);

  //startDeveloperSession(send);
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

async function listen(stream) {
  if (isMethod(data(value(now(stream))), "Debugger.paused")) {
    console.log(data(value(now(stream))).params.callFrames[0]);
  }
  //console.log(data(value(now(stream)l)); // !!!

  return listen(await later(stream));
}

function TEST(send, render) {
  return async (stream) => loop(await IO(displaySource, render)(await IO(pullScriptSource, send)(stream)));
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

function displaySource(render) {
  const display = async (stream) => {
    render(await text(stream));

    return commit(stream, display);
  }
  
  return display;
}

async function text(stream) {
  if (isResult(data(value(now(stream))), "scriptSource") {
    return data(value(now(stream)));
  }
}

async function loop(stream) {
  return continuation(now(stream))(forget(await later(stream)));
}

function startDeveloperSession(send) {
  const repl = Readline.createInterface({ input: process.stdin });

  repl.on('line', (line) => send(...parseOneLine(line)));
}

function inputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

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

function parseOneLine(line) {
  let method, parameters;
  [method, parameters] = line.match(/^([^\s]+)|[^\1]+/g);

  return [method, parseJsValue(parameters ? parameters : "")];
}
