// Copyright (c) Adrien Cransac
// License: MIT

const { insertInEnvironmentTree, isDeferredEntrySelected, isVisitableEntrySelected, makeEnvironmentTree, makePendingEntriesRegister, makeSelectionInEnvironmentTree, refreshSelectedEnvironmentTree, registerPendingEntry, resolvePendingEntry, selectedEnvironmentEntryBranchName, selectedEnvironmentEntryLeafName, selectNextEntry, selectPreviousEntry, visitChildEntry, visitParentEntry } = require('../src/environmenttree.js');
const { branches, root, selectedBranch, selectedEntry, selectedEntryName } = require('@acransac/filetree');
const { init } = require('../src/init.js');
const { parseEnvironmentTree } = require('../src/processes.js');
const { isDebuggerPaused, isEnvironment, isEnvironmentEntry, message, readEnvironment } = require('../src/protocol.js');
const { floatOn, later, now, value } = require('@acransac/streamer');
const Test = require('@acransac/tester');
const { skipToDebuggerPausedAfterStepping } = require('../src/testutils.js');
const util = require('util');

// # Helpers
function makeEnvironment(pathsAndValues, send) {
  return pathsAndValues.reduce(([environmentTree, selection], [path, values]) => {
    return (environmentTree => {
      return [
        environmentTree,
        refreshSelectedEnvironmentTree(selection, environmentTree)
      ];
    })(insertInEnvironmentTree(environmentTree, path, values, send ? send : () => {}));
  }, [makeEnvironmentTree(), makeSelectionInEnvironmentTree(makeEnvironmentTree())]);
}

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

// # Tests
function test_emptyEnvironmentTree(finish, check) {
  const emptyEnvironmentTree = makeEnvironmentTree();

  return finish(check(root(emptyEnvironmentTree) === "/env"
                        && branches(emptyEnvironmentTree).length === 0));
}

function test_selectionInEmptyEnvironmentTree(finish, check) {
  const emptySelection = makeSelectionInEnvironmentTree(makeEnvironmentTree());

  return finish(check(selectedBranch(emptySelection).length === 0
                        && selectedEntryName(selectedEntry(emptySelection)) === ""
                        && selectedEnvironmentEntryLeafName(selectedEntry(emptySelection)) === ""
                        && selectedEnvironmentEntryBranchName(selectedEntry(emptySelection)) === ""));
}

function test_environmentTreeWithOneImmediateEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment([["/env", makeFakeEnvironmentEntriesFromInspector(["a/bc"])]]);

  return finish(check(selectedBranch(selection).length === 1
                        && selectedEntryName(selectedEntry(selection)) === "/String entry0: \"a/bc\""
                        && selectedEnvironmentEntryLeafName(selectedEntry(selection)) === "String entry0: \"a/bc\""
                        && selectedEnvironmentEntryBranchName(selectedEntry(selection)) === ""
                        && !isVisitableEntrySelected(selectedEntry(selection))
                        && !isDeferredEntrySelected(selectedEntry(selection))));
}

function test_environmentTreeWithOneDeferredEntry(finish, check) {
  const [environmentTree, selection] = makeEnvironment([["/env", makeFakeEnvironmentEntriesFromInspector([{}])]]);

  return finish(check(selectedBranch(selection).length === 1
                        && selectedEntryName(selectedEntry(selection)) === "/Object entry0"
                        && selectedEnvironmentEntryLeafName(selectedEntry(selection)) === "Object entry0"
                        && selectedEnvironmentEntryBranchName(selectedEntry(selection)) === ""
                        && isVisitableEntrySelected(selectedEntry(selection))
                        && !isDeferredEntrySelected(selectedEntry(selection))
                        && (deferredEntry => selectedEntryName(deferredEntry) === "/Object entry0/deferred"
                                               && selectedEnvironmentEntryLeafName(deferredEntry) === "deferred"
                                               && selectedEnvironmentEntryBranchName(deferredEntry) === "/Object entry0"
                                               && !isVisitableEntrySelected(deferredEntry)
                                               && isDeferredEntrySelected(deferredEntry))
                             (selectedEntry(visitChildEntry(selection)))));
}

function test_environmentTreeExploration(finish, check) {
  const [environmentTree, selection] = makeEnvironment([["/env", makeFakeEnvironmentEntriesFromInspector([{}, "a/bc"])]]);

  const isEmptyObject = entry => selectedEntryName(entry) === "/Object entry0"
                                   && selectedEnvironmentEntryLeafName(entry) === "Object entry0"
                                   && selectedEnvironmentEntryBranchName(entry) === ""
                                   && isVisitableEntrySelected(entry)
                                   && !isDeferredEntrySelected(entry);

  return finish(check(isEmptyObject(selectedEntry(selection))
                        && (stringEntry => selectedEntryName(stringEntry) === "/String entry1: \"a/bc\""
                                             && selectedEnvironmentEntryLeafName(stringEntry) === "String entry1: \"a/bc\""
                                             && selectedEnvironmentEntryBranchName(stringEntry) === ""
                                             && !isVisitableEntrySelected(stringEntry)
                                             && !isDeferredEntrySelected(stringEntry))
                             (selectedEntry(selectNextEntry(selection)))
                        && isEmptyObject(selectedEntry(selectPreviousEntry(selectNextEntry(selection))))
                        && (deferredEntry => selectedEntryName(deferredEntry) === "/Object entry0/deferred"
                                               && selectedEnvironmentEntryLeafName(deferredEntry) === "deferred"
                                               && selectedEnvironmentEntryBranchName(deferredEntry) === "/Object entry0"
                                               && !isVisitableEntrySelected(deferredEntry)
                                               && isDeferredEntrySelected(deferredEntry))
                             (selectedEntry(visitChildEntry(selection)))
                        && isEmptyObject(selectedEntry(visitParentEntry(visitChildEntry(selection))))));
}

function test_resolveDeferredEntry(finish, check) {
  const testSession = (send, render, terminate) => {
    const queryDeferredEntry = () => {
      const requester = (environmentTree, selection, pendingEntriesRegister) => async (stream) => {
        if (isDebuggerPaused(message(stream))) {
          return requester(environmentTree, selection, pendingEntriesRegister)
                   (await later(await parseEnvironmentTree(send)(stream)));
        }
        else if (isEnvironment(message(stream))) {
          const [newEnvironmentTree, newSelection] = makeEnvironment([["/env", readEnvironment(message(stream))]], send);

          const deferredSelection = visitChildEntry(newSelection);

          return requester(newEnvironmentTree,
                           deferredSelection,
                           registerPendingEntry(pendingEntriesRegister, deferredSelection))
                   (await later(stream));
        }
        else if (isEnvironmentEntry(message(stream))) {
          const finishTest = (environmentTree, selection, pendingEntriesRegister) => {
            return floatOn(stream, selectedEntryName(selectedEntry(selection)) === "/Object test/String a: \"abc\""
                                     && selectedEnvironmentEntryLeafName(selectedEntry(selection)) === "String a: \"abc\""
                                     && selectedEnvironmentEntryBranchName(selectedEntry(selection)) === "/Object test"
                                     && !isVisitableEntrySelected(selectedEntry(selection))
                                     && !isDeferredEntrySelected(selectedEntry(selection)));
          };

          return resolvePendingEntry(environmentTree,
                                     selection,
                                     pendingEntriesRegister,
                                     message(stream),
                                     entries => entries.filter(entry => entry.isOwn),
                                     send,
                                     finishTest);
        }
        else {
          return floatOn(stream, false);
        }
      };

      return requester(makeEnvironmentTree(),
                       makeSelectionInEnvironmentTree(makeEnvironmentTree()),
                       makePendingEntriesRegister());
    };

    return async (stream) => {
      return terminate(check(value(now(await queryDeferredEntry()
                                        (await skipToDebuggerPausedAfterStepping(send, 1)(stream))))));
    };
  };

  init(["node", "app.js", "targets/test_target.js"], testSession, finish);
}

function test_explorationSkipsDeferredEntries(finish, check) {
  const [environmentTree, selection] = makeEnvironment([
    ["/env", makeFakeEnvironmentEntriesFromInspector([{a: {b: "b"}}])],
    ["/env/Object entry0", makeFakeEnvironmentEntriesFromInspector([{b: "b"}])],
    ["/env/Object entry0/Object entry0", makeFakeEnvironmentEntriesFromInspector(["b"])]
  ]);

  const isExpectedObject = entry => selectedEntryName(entry) === "/Object entry0/Object entry0"
                                      && selectedEnvironmentEntryLeafName(entry) === "Object entry0"
                                      && selectedEnvironmentEntryBranchName(entry) === "/Object entry0"
                                      && isVisitableEntrySelected(entry)
                                      && !isDeferredEntrySelected(entry);

  return finish(check(isExpectedObject(selectedEntry(visitChildEntry(selection)))
                        && isExpectedObject(selectedEntry(selectPreviousEntry(visitChildEntry(selection))))
                        && isExpectedObject(selectedEntry(visitParentEntry(visitChildEntry(visitChildEntry(selection)))))));
}

module.exports = Test.run([
  Test.makeTest(test_emptyEnvironmentTree, "Empty Environment Tree"),
  Test.makeTest(test_selectionInEmptyEnvironmentTree, "Selection In Empty Environment Tree"),
  Test.makeTest(test_environmentTreeWithOneImmediateEntry, "Environment Tree With One Immediate Entry"),
  Test.makeTest(test_environmentTreeWithOneDeferredEntry, "Environment Tree With One Deferred Entry"),
  Test.makeTest(test_environmentTreeExploration, "Environment Tree Exploration"),
  Test.makeTest(test_resolveDeferredEntry, "Resolve Deferred Entry"),
  Test.makeTest(test_explorationSkipsDeferredEntries, "Exploration Skips Deferred Entries")
], "Test Environment Tree");
