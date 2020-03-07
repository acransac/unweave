const { insertInEnvironmentTree, isDeferredEntrySelected, isVisitableEntrySelected, makeEnvironmentTree, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, visitEnvironmentEntry } = require('./environmenttree.js');
const { branches, root, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryHandle, selectedEntryLeafName, selectedEntryName } = require('filetree');
const Test = require('tester');
const util = require('util');

function makeFakeEnvironmentEntriesFromInspector(values) {
  const entryValueFromInspector = (value, id) => {
    const makeFakeRemoteHandle = id => JSON.stringify({injectedScriptId: 1, id: id});

    const instanceOf = (prototypes, value) => prototypes.filter(prototype => value instanceof prototype);

    const enumerableValueFromInspector = (typeCategory, lengthFunction) => {
      return (valueTypeName, value) => {
        return {
          type: "object",
          subtype: typeCategory,
          className: valueTypeName,
	  description: `${valueTypeName}(${lengthFunction(value)})`,
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
      return {type: "symbol", description: value.toString(), objectId: makeFakeRemoteHandle(id)};
    }
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
    else if (instanceOf([Array], value).length > 0) {
      return (prototypeName => enumerableValueFromInspector("array", value => value.length)
	                         (prototypeName, value))
        (instanceOf([Array], value)[0].name);
    }
    else if (instanceOf([DataView], value).length > 0) {
      return (prototypeName => enumerableValueFromInspector("dataview", value => value.byteLength)
	                         (prototypeName, value))
        (instanceOf([DataView], value)[0].name);
    }
    else if (instanceOf([Map, Set], value).length > 0) {
      return (prototypeName => enumerableValueFromInspector(prototypeName.toLowerCase(), value => value.size)
	                         (prototypeName, value))
        (instanceOf([Map, Set], value)[0].name);
    }
    else if (instanceOf(typedArrayPrototypes, value).length > 0) {
      return enumerableValueFromInspector("typedarray", value => value.length)
	       (instanceOf(typedArrayPrototypes, value)[0].name, value);
    }
    else if (instanceOf([ArrayBuffer, SharedArrayBuffer], value).length > 0) {
      return enumerableValueFromInspector("arraybuffer", value => value.byteLength)
	       (instanceOf([ArrayBuffer, SharedArrayBuffer], value)[0].name, value);
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
    else if (util.types.isProxy(value)) {
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
    return {name: `entry${id}`, value: entryValueFromInspector(value, id)};
  });
}

function makeEnvironment(values) {
  return (environmentTree => {
    return [
      environmentTree,
      refreshSelectedEnvironmentTree(makeSelectionInEnvironmentTree(makeEnvironmentTree()), environmentTree)
    ];
  })(insertInEnvironmentTree(makeEnvironmentTree(), "/env", makeFakeEnvironmentEntriesFromInspector(values), () => {}));
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
	                && selectedEntryHandle(selectedEntry(emptySelection)) === undefined));
}

function test_environmentTreeWithOneImmediateEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment(["abc"]);

  return finish(check(selectedBranch(selection).length === 1
	                && selectedEntryName(selectedEntry(selection)) === "/String entry0: \"abc\""
	                && selectedEntryLeafName(selectedEntry(selection)) === "String entry0: \"abc\""
	                && selectedEntryBranchName(selectedEntry(selection)) === ""
	                && !isVisitableEntrySelected(selectedEntry(selection))
	                && !isDeferredEntrySelected(selectedEntry(selection))));
}

function test_environmentTreeWithOneDeferredEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment([{}]);

  return finish(check(selectedBranch(selection).length === 1
	                && selectedEntryName(selectedEntry(selection)) === "/Object entry0"
	                && selectedEntryLeafName(selectedEntry(selection)) === "Object entry0"
	                && selectedEntryBranchName(selectedEntry(selection)) === ""
	                && isVisitableEntrySelected(selectedEntry(selection))
	                && isDeferredEntrySelected(selectedEntry(visitEnvironmentEntry(selection)))));
}

Test.run([
  Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
  Test.makeTest(test_selectionInEmptyEnvironmentTree, "Selection In Empty Environment Tree"),
  Test.makeTest(test_environmentTreeWithOneImmediateEntry, "Environment Tree With One Immediate Entry"),
  Test.makeTest(test_environmentTreeWithOneDeferredEntry, "Environment Tree With One Deferred Entry")
]);
