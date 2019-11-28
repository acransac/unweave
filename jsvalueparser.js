function parseJsValue(jsValueString) {
  return syntaxJsValue(lexJsValue(jsValueString));
}

function lexJsValue(jsValueString) {
  const lexJsValueImpl = (tokens, jsValueString) => {
    if (jsValueString === "") {
      return [tokens, jsValueString];
    }
  
    switch (jsValueString[0]) {
      case '{': return lexJsValueImpl([...tokens, 'ObjBegin'], jsValueString.substring(1));
      case '}': return lexJsValueImpl([...tokens, 'ObjEnd'], jsValueString.substring(1));
      case '[': return lexJsValueImpl([...tokens, 'ArrayBegin'], jsValueString.substring(1));
      case ']': return lexJsValueImpl([...tokens, 'ArrayEnd'], jsValueString.substring(1));
      case ':': return lexJsValueImpl([...tokens, 'KeyValueSeparator'], jsValueString.substring(1));
      case ',': return lexJsValueImpl([...tokens, 'IterableElementSeparator'], jsValueString.substring(1));
      case ' ': return lexJsValueImpl(tokens, jsValueString.substring(1));
      default: return lexJsValueImpl(...lexAtom(tokens, jsValueString));
    }
  };

  return lexJsValueImpl([], jsValueString)[0];
}

function lexAtom(tokens, jsValueString) {
  const tokensWithAtomAndRest = (atom, rest) => [[...tokens, `Atom: ${atom}`], rest === undefined ? "" : rest];

  if (jsValueString[0] === "\"") {
    return tokensWithAtomAndRest(...stringAtom(jsValueString));
  }
  else {
    return tokensWithAtomAndRest(...jsValueString.match(/^([^:,\s\]\}]+)|[^\1]+/g));
  }
}

function stringAtom(jsValueString) {
  const stringAtomImpl = (atom, jsValueString) => {
    if (jsValueString[0] === "\"") {
      return [`${atom}"`, jsValueString.slice(1)];
    }
    if (jsValueString.startsWith("\\\"")) {
      return stringAtomImpl(`${atom}"`, jsValueString.slice(2));
    }
    else {
      return stringAtomImpl(`${atom}${jsValueString[0]}`, jsValueString.slice(1));
    }
  };

  return stringAtomImpl("\"", jsValueString.slice(1));
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

  const matchStringOrNumber = jsValueString => {
    return jsValueString.search(/[0-9.]+/g) === 0 ? Number(jsValueString) : jsValueString.slice(1, -1);
  };

  const value = getAtomicValue(atom);

  switch (value) {
    case "true": return [true, tokens.slice(1)];
    case "false": return [false, tokens.slice(1)];
    case "null": return [null, tokens.slice(1)];
    case "undefined": return [undefined, tokens.slice(1)];
    default: return [matchStringOrNumber(value), tokens.slice(1)];
  }
}

function syntaxObject(object, tokens) {
  if (tokens.length === 0) {
    throw "invalid syntax";
  }

  switch (tokens[0]) {
    case 'ObjEnd': return [object, tokens.slice(1)];
    case 'IterableElementSeparator': return syntaxObject(object, tokens.slice(1));
    default: return syntaxObject(...syntaxObjectKeyValuePair(object, tokens));
  }
}

function syntaxObjectKeyValuePair(object, tokens) {
  if (tokens.length < 3 || !isAtom(tokens[0]) || tokens[1] !== "KeyValueSeparator") {
    throw "invalid syntax";
  }

  const [objectProperty, rest] = syntaxJsValueImpl(null, tokens.slice(2));

  object[getAtomicValue(tokens[0])] = objectProperty;

  return [object, rest];
}

function syntaxArray(array, tokens) {
  if (tokens.length === 0) {
    throw "invalid syntax";
  }

  switch (tokens[0]) {
    case 'ArrayEnd': return [array, tokens.slice(1)];
    case 'IterableElementSeparator': return syntaxArray(array, tokens.slice(1));
    default: return syntaxArray(...((element, rest) => [[...array, element], rest])(...syntaxJsValueImpl(tokens[0], tokens)));
  }
}

module.exports = parseJsValue;
