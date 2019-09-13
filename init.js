const { inputCapture, isMethod, isResult, data } = require('./messages.js');
const { debugSession } = require('./sessions.js');
const { Source, mergeEvents, now, later, value, IO } = require('streamer');
const { renderer } = require('terminal');
const WebSocket = require('ws');

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
