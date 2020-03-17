const { insertInEnvironmentTree, isDeferredEntrySelected, isVisitableEntrySelected, makeEnvironmentTree, makePendingEntriesRegister, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, registerPendingEntry, resolvePendingEntry, visitChildEntry, visitParentEntry } = require('./environmenttree.js');
const { branches, root, selectedBranch, selectedEntry, selectedEntryBranchName, selectedEntryLeafName, selectedEntryName, selectNext, selectPrevious } = require('filetree');
const { init } = require('./init.js');
const { pullEnvironment } = require('./processes.js');
const { isDebuggerPaused, isEnvironment, isEnvironmentEntry, message, name, readEnvironment, sendStepOver } = require('./protocol.js');
const { floatOn, later, now, value } = require('streamer');
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

function makeEnvironment(values, send) {
  return (environmentTree => {
    return [
      environmentTree,
      refreshSelectedEnvironmentTree(makeSelectionInEnvironmentTree(makeEnvironmentTree()), environmentTree)
    ];
  })(insertInEnvironmentTree(makeEnvironmentTree(), "/env", values, send ? send : () => {}));
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
	                && selectedEntryBranchName(selectedEntry(emptySelection)) === ""));
}

function test_environmentTreeWithOneImmediateEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment(makeFakeEnvironmentEntriesFromInspector(["abc"]));

  return finish(check(selectedBranch(selection).length === 1
	                && selectedEntryName(selectedEntry(selection)) === "/String entry0: \"abc\""
	                && selectedEntryLeafName(selectedEntry(selection)) === "String entry0: \"abc\""
	                && selectedEntryBranchName(selectedEntry(selection)) === ""
	                && !isVisitableEntrySelected(selectedEntry(selection))
	                && !isDeferredEntrySelected(selectedEntry(selection))));
}

function test_environmentTreeWithOneDeferredEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment(makeFakeEnvironmentEntriesFromInspector([{}]));

  return finish(check(selectedBranch(selection).length === 1
	                && selectedEntryName(selectedEntry(selection)) === "/Object entry0"
	                && selectedEntryLeafName(selectedEntry(selection)) === "Object entry0"
	                && selectedEntryBranchName(selectedEntry(selection)) === ""
	                && isVisitableEntrySelected(selectedEntry(selection))
	                && !isDeferredEntrySelected(selectedEntry(selection))
	                && (deferredEntry => selectedEntryName(deferredEntry) === "/Object entry0/deferred"
			                       && selectedEntryLeafName(deferredEntry) === "deferred"
			                       && selectedEntryBranchName(deferredEntry) === "/Object entry0"
	                                       && !isVisitableEntrySelected(deferredEntry)
	                                       && isDeferredEntrySelected(deferredEntry))
			     (selectedEntry(visitChildEntry(selection)))));
}

function test_environmentTreeExploration(finish, check) {
  const [environmentTree, selection] = makeEnvironment(makeFakeEnvironmentEntriesFromInspector([{}, "abc"]));

  const isEmptyObject = entry => selectedEntryName(entry) === "/Object entry0"
	                           && selectedEntryLeafName(entry) === "Object entry0"
	                           && selectedEntryBranchName(entry) === ""
	                           && isVisitableEntrySelected(entry)
	                           && !isDeferredEntrySelected(entry);

  return finish(check(isEmptyObject(selectedEntry(selection))
	                && (stringEntry => selectedEntryName(stringEntry) === "/String entry1: \"abc\""
			                     && selectedEntryLeafName(stringEntry) === "String entry1: \"abc\""
			                     && selectedEntryBranchName(stringEntry) === ""
	                                     && !isVisitableEntrySelected(stringEntry)
	                                     && !isDeferredEntrySelected(stringEntry))
	                     (selectedEntry(selectNext(selection)))
	                && isEmptyObject(selectedEntry(selectPrevious(selectNext(selection))))
	                && (deferredEntry => selectedEntryName(deferredEntry) === "/Object entry0/deferred"
			                       && selectedEntryLeafName(deferredEntry) === "deferred"
			                       && selectedEntryBranchName(deferredEntry) === "/Object entry0"
	                                       && !isVisitableEntrySelected(deferredEntry)
	                                       && isDeferredEntrySelected(deferredEntry))
			     (selectedEntry(visitChildEntry(selection)))
	                && isEmptyObject(selectedEntry(visitParentEntry(visitChildEntry(selection))))));
}

function test_pendingEntries(finish, check) {
  const testSession = (send, render, terminate) => {
    const queryDeferredEntry = () => {
      const requester = (sessionIsSetUp, environmentTree, selection, pendingEntriesRegister) => async (stream) => {
	if (isDebuggerPaused(message(stream))) {
	  if (sessionIsSetUp) {
	    return requester(true, environmentTree, selection, pendingEntriesRegister)
		     (await later(await pullEnvironment(send)(stream)));
	  }
	  else {
	    sendStepOver(send);

	    return requester(true, environmentTree, selection, pendingEntriesRegister)(await later(stream));
	  }
        }
	else if (isEnvironment(message(stream))) {
          const [newEnvironmentTree, newSelection] = makeEnvironment(readEnvironment(message(stream)).filter(entry => {
            return !(name(entry) === "exports" || name(entry) === "require" || name(entry) === "module"
		     || name(entry) === "__filename" || name(entry) === "__dirname");
	  }), send);

	  const newPendingEntriesRegister = registerPendingEntry(pendingEntriesRegister, visitChildEntry(newSelection));

	  return requester(true, newEnvironmentTree, newSelection, newPendingEntriesRegister)(await later(stream));
        }
	else if (isEnvironmentEntry(message(stream))) {
	  const finishTest = (environmentTree, selection, pendingEntriesRegister) => {
	    console.log(selectedEntry(selection));

	    return floatOn(stream, selectedEntryName(selectedEntry(selection)) === "/Object test/String a: \"abc\""
	                             && selectedEntryLeafName(selectedEntry(selection)) === "String a: \"abc\""
	                             && selectedEntryBranchName(selectedEntry(selection)) === "/Object test"
	                             && !isVisitableEntrySelected(selectedEntry(selection))
	                             && !isDeferredEntrySelected(selectedEntry(selection)));
	  };

          return resolvePendingEntry(environmentTree, selection, pendingEntriesRegister, message(stream), send, finishTest);
        }
	else {
	  return requester(sessionIsSetUp, environmentTree, selection, pendingEntriesRegister)(await later(stream));
        }
      };

      return requester(false,
	               makeEnvironmentTree(),
	               makeSelectionInEnvironmentTree(makeEnvironmentTree()),
	               makePendingEntriesRegister());
    };

    return async (stream) => {
      return finish(terminate(check(value(now(await queryDeferredEntry()(stream))))));
    };
  }

  init(["node", "app.js", "test_target.js"], testSession);
}

Test.run([
  //Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
  //Test.makeTest(test_selectionInEmptyEnvironmentTree, "Selection In Empty Environment Tree"),
  //Test.makeTest(test_environmentTreeWithOneImmediateEntry, "Environment Tree With One Immediate Entry"),
  //Test.makeTest(test_environmentTreeWithOneDeferredEntry, "Environment Tree With One Deferred Entry"),
  //Test.makeTest(test_environmentTreeExploration, "Environment Tree Exploration"),
  Test.makeTest(test_pendingEntries, "Pending Entries")
]);
