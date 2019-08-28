const parseJsValue = require('./jsvalueparser.js');
const Readline = require('readline');
const { Source, now, later, floatOn, IO } = require('./streamer.js');
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

  Source.from(webSocket, "onmessage").withDownstream(async (stream) => IO(enableDebugger, send)(await runtimeEnabled(stream)));

  enableRuntime(send);
}

function enableRuntime(send) {
  send("Runtime.enable", {});

  return runtimeEnabled;
}

function enableDebugger(send) {
  send("Debugger.enable", {});

  return debuggerEnabled;
}

async function runtimeEnabled(stream) {
  if (isMethod(data(now(stream)), "Runtime.executionContextCreated")) {
    return stream;
  }
  else {
    return runtimeEnabled(await later(stream));
  }
}

async function debuggerEnabled(stream) {
  if (isResult(data(now(stream)), "debuggerId")) {
    return stream;
  }
  else {
    return debuggerEnabled(await later(stream));
  }
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

function receive(message) {
  console.log(message.data);
}

function readOneLine(ws, line) {
  let method, parameters;

  [method, parameters] = parseOneLine(line);
  
  ws.send(JSON.stringify({
    method: method,
    params: parameters,
    id: 0
  }));
}

function parseOneLine(line) {
  return line.match(/^([^\s]+)|[^\1]+/g);
}
