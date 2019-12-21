const { debugSession } = require('./debugsession.js');
const { isDebuggerEnabled, isExecutionContextCreated, makeInput, makeInspectorQuery, message, sendEnableDebugger, sendEnableRuntime, sendStartRun } = require('./protocol.js');
const Readline = require('readline');
const { makeEmitter, mergeEvents, later, Source } = require('streamer');
const { renderer } = require('terminal');
const WebSocket = require('ws');

connectToInspector(process.argv[2]);

function connectToInspector(sessionHash) {
  const webSocket = new WebSocket(`ws://localhost:9230/${sessionHash}`);

  webSocket.onopen = () => {
    console.log("Connection opened");
 
    startDebugSession(webSocket);
  };

  webSocket.onerror = error => console.log(error);

  webSocket.onclose = () => {
    console.log("Connection closed");
  
    process.exit();
  };
}

function inputCapture() {
  Readline.emitKeypressEvents(process.stdin);

  process.stdin.setRawMode(true);

  process.stdin.on('keypress', key => process.stdin.emit('input', makeInput(key)));

  return process.stdin;
}

function startDebugSession(webSocket) {
  const send = (methodName, parameters) => webSocket.send(makeInspectorQuery(methodName, parameters));

  const [render, closeDisplay] = renderer();

  const terminate = () => {
    closeDisplay();

    setImmediate(() => webSocket.close());
  };

  Source.from(mergeEvents([makeEmitter(inputCapture(), "input"), makeEmitter(webSocket, "message")]), "onevent")
	.withDownstream(async (stream) => 
	  debugSession(send, render, terminate)(
	    await runProgram(send)(
	      await enableDebugger(send)(
	        await runtimeEnabled(stream)))));

  sendEnableRuntime(send);
}

async function runtimeEnabled(stream) {
  if (isExecutionContextCreated(message(stream))) {
    return stream;
  }
  else {
    return runtimeEnabled(await later(stream));
  }
}

function enableDebugger(send) {
  return stream => {
    sendEnableDebugger(send);

    const debuggerEnabled = async (stream) => {
      if (isDebuggerEnabled(message(stream))) {
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
    sendStartRun(send);

    return stream;
  };
}
