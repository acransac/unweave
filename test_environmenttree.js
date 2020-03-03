const { isAtomicEntrySelected, makeEnvironmentTree, makeSelectionInEnvironmentTree } = require('./environmenttree.js');
const { branches, root, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectedEntryName } = require('filetree');
const Test = require('tester');

function fakeEnvironmentEntriesFromInspector(values) {
  const entryValueFromInspector = (value, id) => {
    const makeFakeRemoteHandle = id => JSON.stringify({injectedScriptId: 1, id: id});

    const instanceOf = (prototypes, value) => prototypes.filter(prototype => value instanceof prototype);

    const enumerableValueFromInspector = typeName => {
      return (valueTypeName, value) => {
        return {
          type: "object",
          subtype: typeName,
          className: valueTypeName,
	  description: `${valueTypeName}(${value.length})`,
	  objectId: makeFakeRemoteHandle(id)
	};
      };
    };

    const typedArrayPrototypes = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];

    if (value === undefined) {
      return {type: "undefined"};
    }
    else if (value === null) {
      return {type: "object", subtype: "null", value: null};
    }
    else if (typeof value === "boolean") {
      return {type: "boolean", value: value};
    }
    else if (typeof value === "number") {
      return {type: "number", value: value, description: value};
    }
    else if (typeof value === "string") {
      return {type: "string", value: value};
    }
    else if (typeof value === "symbol") {
      return {type: "symbol", description: value, objectId: makeFakeRemoteHandle(id)};
    }
    // Async and sync treated the same way in tests
    else if (typeof value === "function") {
      return {
        type: "function",
	className: `${value.toString().startsWith("async") ? "Async" : ""}Function`,
	description: value.toString(),
	objectId: makeFakeRemoteHandle(id)
      };
    }
    // value can only be an object in the following cases
    else if (value instanceof Date) {
      return {type: "object", subtype: "date", className: "Date", description: value, objectId: makeFakeRemoteHandle(id)};
    }
    else if (instanceOf([Array, Map, Set, DataView], value).length > 0) {
      return (prototypeName => enumerableValueFromInspector(prototypeName.toLowerCase())(prototypeName, value))
        (instanceOf([Array, Map, Set, DataView], value)[0].name);
    }
    else if (instanceOf(typedArrayPrototypes, value).length > 0) {
      return enumerableValueFromInspector("typedarray")(instanceOf(typedArrayPrototypes, value)[0].name, value);
    }
    else if (instanceOf([ArrayBuffer, SharedArrayBuffer], value).length > 0) {
      return enumerableValueFromInspector("arraybuffer")(instanceOf([ArrayBuffer, SharedArrayBuffer], value)[0].name, value);
    }
    else if (value instanceof Promise) {
      return {
        type: "object",
	subtype: "promise",
	className: "Promise",
	description: "Promise",
	objectId: makeFakeRemoteHandle(id)
      };
    }
    else if (value instanceof Proxy) {
      return {
        type: "object",
	subtype: "proxy",
	className: "Object",
	description: "Proxy",
	objectId: makeFakeRemoteHandle(id)
      };
    }
    // General object
    else {
      return {type: "object", className: "Object", description: "Object", objectId: makeFakeRemoteHandle(id)};
    }
  };

  return values.map((value, id) => {
    name: `entry${id + 1}`,
    value: entryValueFromInspector(value, id),
  });
}

function test_emptyEnvironmentTree(finish, check) {
  const emptyEnvironmentTree = makeEnvironmentTree();

  return finish(check(root(emptyEnvironmentTree) === "/env"
	                && branches(emptyEnvironmentTree).length === 0));
}

function test_selectionInEmptyEnvironmentTree(finish, check) {
  const emptySelection = makeSelectionInEnvironmentTree(makeEnvironmentTree());

  return finish(check(selectedBranch(emptySelection).length === 0
	                && selectedEntryName(selectedEntry(emptySelection)) === ""
	                && selectedEntryLeafName(selectedEntry(emptySelection)) === ""
	                && selectedEntryBranchName(selectedEntry(emptySelection)) === ""
	                && selectedEntryHandle(selectedEntry(emptySelection)) === undefined
	                && isAtomicEntrySelected(selectedEntry(emptySelection))));
}

Test.run([
  Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
  Test.makeTest(test_selectionInEmptyEnvironmentTree, "Selection In Empty Environment Tree")
]);
