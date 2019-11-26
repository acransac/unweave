const { debugSession } = require('./debugsession.js');
const { isMethod, isResult, message } = require('./protocol.js');
const Readline = require('readline');
const { makeEmitter, mergeEvents, now, later, Source, value } = require('streamer');
const { renderer } = require('terminal');
const WebSocket = require('ws');

connectToInspector(process.argv[2]);

function connectToInspector(sessionHash) {
  const webSocket = new WebSocket(`ws://localhost:9230/${sessionHash}`);

  webSocket.onopen = () => startDebugSession(webSocket);

  webSocket.onerror = error => console.log(error);
}

function inputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

  process.stdin.on('keypress', key => process.stdin.emit('input', JSON.stringify({input: key})));

  return process.stdin;
}

function startDebugSession(webSocket) {
  console.log("Connection opened");

  const send = (methodName, parameters) => webSocket.send(JSON.stringify({method: methodName, params: parameters, id: 0}));

  const [render, close] = renderer();

  Source.from(mergeEvents([makeEmitter(inputCapture(), "input"), makeEmitter(webSocket, "message")]), "onevent")
	.withDownstream(async (stream) => 
	  debugSession(send, render)(await runProgram(send)(await enableDebugger(send)(await runtimeEnabled(stream)))));

  send("Runtime.enable", {});
}

async function runtimeEnabled(stream) {
  if (isMethod(message(stream), "Runtime.executionContextCreated")) {
    return stream;
  }
  else {
    return runtimeEnabled(await later(stream));
  }
}

function enableDebugger(send) {
  return stream => {
    send("Debugger.enable", {});

    const debuggerEnabled = async (stream) => {
      if (isResult(message(stream), "debuggerId")) {
        return stream;
      }
      else {
        return debuggerEnabled(await later(stream));
      }
    };

    return debuggerEnabled(stream);
  };
}

function runProgram(send) {
  return async (stream) => {
    send("Runtime.runIfWaitingForDebugger", {});

    return stream;
  };
}
