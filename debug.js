const EventEmitter = require('events');
const parseJsValue = require('./jsvalueparser.js');
const Readline = require('readline');
const { Source, now, later, value, continuation, floatOn, commit, forget, IO } = require('streamer');
const { renderer, cons, emptyList, atom } = require('terminal');
const WebSocket = require('ws');

class WrappedEventEmitter extends EventEmitter {
  constructor(emitter, emissionCallbackName) {
    super();

    this[emissionCallbackName] = undefined;

    this.emitter = emitter;

    emitter.on(emissionCallbackName, (message) => this[emissionCallbackName](message));
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

  startInputCapture();

  const send = (methodName, parameters) => webSocket.send(JSON.stringify({method: methodName, params: parameters, id: 0}));

  Source.from(webSocket, "onmessage").withDownstream(async (stream) => listen(await IO(runProgram, send)(await IO(enableDebugger, send)(await runtimeEnabled(stream)))));

  enableRuntime(send);

  startDeveloperSession(send);
}

function enableRuntime(send) {
  send("Runtime.enable", {});

  return runtimeEnabled;
}

async function runtimeEnabled(stream) {
  if (isMethod(data(now(stream)), "Runtime.executionContextCreated")) {
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
  if (isResult(data(now(stream)), "debuggerId")) {
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

async function programStarted(stream, continuation) {
  if (isMethod(data(now(stream)), "Debugger.scriptParsed")) {
    return programStarted(await later(stream), () => data(now(stream)).params.scriptId);
  }
  else if (isMethod(data(now(stream)), "Debugger.paused")) {
    //return floatOn(stream, continuation());
    console.log(`script id: ${continuation()}`); // !!!

    return stream;                               // !!!
  }
  else {
    return programStarted(await later(stream), continuation);
  }
}

async function listen(stream) {
  if (isMethod(data(now(stream)), "Debugger.paused")) {
    console.log(data(now(stream)).params.callFrames[0]);
  }
  //console.log(data(now(stream))); // !!!

  return listen(await later(stream));
}

function startDeveloperSession(send) {
  const repl = Readline.createInterface({ input: process.stdin });

  repl.on('line', (line) => send(...parseOneLine(line)));
}

function startInputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

  return [new WrappedEventEmitter(process.stdin, "onkeypress"), "onkeypress"];
}

function data(message) {
  return JSON.parse(message.data);
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
