function parseJson(jsonString) {
  return syntaxJsValue(lexJson(jsonString));
}

function lexJson(jsonString) {
  return lexJsonImpl([], jsonString)[0];
}

function lexJsonImpl(tokens, jsonString) {
  if (jsonString === "") {
    return [tokens, jsonString];
  }

  switch (jsonString[0]) {
    case '{': return lexJsonImpl([...tokens, 'ObjBegin'],
jsonString.substring(1));
    case '}': return lexJsonImpl([...tokens, 'ObjEnd'],
jsonString.substring(1));
    case '[': return lexJsonImpl([...tokens, 'ArrayBegin'],
jsonString.substring(1));
    case ']': return lexJsonImpl([...tokens, 'ArrayEnd'],
jsonString.substring(1));
    case ':': return lexJsonImpl([...tokens, 'KeyValueSeparator'],
jsonString.substring(1));
    case ',': return lexJsonImpl([...tokens, 'IterableElementSeparator'],
jsonString.substring(1));
    case ' ': return lexJsonImpl(tokens, jsonString.substring(1));
    default: return lexJsonImpl(...lexAtom(tokens, jsonString));
  }
}

function lexAtom(tokens, jsonString) {
  let atom, rest;
  if (jsonString[0] === "\"") {
    [atom, rest] = jsonString.match(/^"(.*?)"|[^\1]+/g);
  }
  else {
    [atom, rest] = jsonString.match(/^([^:,\s\]\}]+)|[^\1]+/g);
  }

  return [[...tokens, `Atom: ${atom}`], rest === undefined ? "" : rest];
}

function syntaxJsValue(tokens) {
  return syntaxJsValueImpl(null, tokens)[0];
}

function syntaxJsValueImpl(jsValue, tokens) {
  if (tokens.length === 0) {
    return [jsValue, tokens];
  }

  switch (tokens[0]) {
    case 'ObjBegin': return syntaxObject({}, tokens.slice(1));
    case 'ArrayBegin': return syntaxArray([], tokens.slice(1));
    default: return syntaxAtomicValue(tokens[0], tokens);
  }
}

function isAtom(atom) {
  return atom.search(/^Atom: /g) === 0;
}

function getAtomicValue(atom) {
  return atom.match(/(^Atom: )|[^\1]+/g)[1];
}

function syntaxAtomicValue(atom, tokens) {
  if (!isAtom(atom)) {
    throw "invalid syntax";
  }

  const value = getAtomicValue(atom);

  switch (value) {
    case "true": return [true, tokens.slice(1)];
    case "false": return [false, tokens.slice(1)];
    case "null": return [null, tokens.slice(1)];
    case "undefined": return [undefined, tokens.slice(1)];
    default: return [matchStringOrNumber(value), tokens.slice(1)];
  }
}

function matchStringOrNumber(valueString) {
  return valueString.search(/[0-9.]+/g) === 0 ? Number(valueString) : valueString.slice(1, -1);
}

function syntaxObject(object, tokens) {
  if (tokens.length === 0) {
    throw "invalid syntax";
  }

  switch (tokens[0]) {
    case 'ObjEnd': return [object, tokens.slice(1)];
    case 'IterableElementSeparator': return syntaxObject(object,
tokens.slice(1));
    default: return syntaxObject(...syntaxObjectKeyValuePair(object,
tokens));
  }
}

function syntaxObjectKeyValuePair(object, tokens) {
  if (tokens.length < 3 || !isAtom(tokens[0]) || tokens[1] !==
"KeyValueSeparator") {
    throw "invalid syntax";
  }

  let objectProperty, rest
  [objectProperty, rest] = syntaxJsValueImpl(null, tokens.slice(2));

  object[getAtomicValue(tokens[0])] = objectProperty;

  return [object, rest];
}

function syntaxArray(array, tokens) {
  if (tokens.length === 0) {
    throw "invalid syntax";
  }

  switch (tokens[0]) {
    case 'ArrayEnd': return [array, tokens.slice(1)];
    case 'IterableElementSeparator': return syntaxArray(array,
tokens.slice(1));
    default: return syntaxArray(...syntaxArrayElement(array, tokens));
  }
}

function syntaxArrayElement(array, tokens) {
  let element, rest;
  [element, rest] = syntaxJsValueImpl(tokens[0], tokens);

  return [[...array, element], rest];
}

module.exports = parseJson;
