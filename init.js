const { debugSession } = require('./debugsession.js');
const { isDebuggerEnabled, isExecutionContextCreated, makeInput, makeInspectorQuery, message, sendEnableDebugger, sendEnableRuntime, sendStartRun } = require('./protocol.js');
const Readline = require('readline');
const { makeEmitter, mergeEvents, later, Source } = require('streamer');
const { renderer } = require('terminal');
const WebSocket = require('ws');

// Inspector uri type --
function makeInspectorUri(address, port, sessionHash) {
  return [address ? address : "127.0.0.1", port ? port : "9229", sessionHash];
}

function address(inspectorUri) {
  return inspectorUri[0];
}

function port(inspectorUri) {
  return inspectorUri[1];
}

function sessionHash(inspectorUri) {
  return inspectorUri[2];
}

function parseInspectorUri(uriString) {
}

// Debug session initializer --
connectToInspector(parseCliArguments(process.argv));

function parseCliArguments(cliArguments) {
  const parseUriOptions = (inspectorUri, uriOptions) => {
    if (uriOptions.length === 0) {
      return inspectorUri;
    }
    else {
      switch (uriOptions[0]) {
        case "--uri":
        case "-u":
          return makeInspectorUri(parseInspectorUri(uriOptions[1]));
	  break;
        case "--address":
	case "-a":
          return parseUriOptions(makeInspectorUri(uriOptions[1], port(inspectorUri), sessionHash(inspectorUri)),
		                 uriOptions.slice(2));
	  break;
        case "--port":
	case "-p":
          return parseUriOptions(makeInspectorUri(address(inspectorUri), uriOptions[1], sessionHash(inspectorUri)),
		                 uriOptions.slice(2));
	  break;
        case "--session":
	case "-s":
          return parseUriOptions(makeInspectorUri(address(inspectorUri), port(inspectorUri), uriOptions[1]),
		                 uriOptions.slice(2));
	  break;
	default:
	  throw "Uri option not valid";
      }
    }
  };

  // Command line is [node binary] ["init.js"] [script | uri options]
  if (cliArguments.length === 2) {
    throw "Specify either a script to debug or an Inspector session uri";
  }
  else if (cliArguments.length === 3) {
    return startInspectedProcess(cliArguments[2]);
  }
  else if (cliArguments.length % 2 > 0) {
    throw "Specify one value for each uri option provided";
  }
  else {
    return parseUriOptions(makeInspectorUri(), cliArguments.slice(2));
  }
}

function startInspectedProcess(scriptPath) {
}

function connectToInspector(inspectorUri) {
  const webSocket = new WebSocket(`ws://${address(inspectorUri)}:${port(inspectorUri)}/${sessionHash(inspectorUri)}`);

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
