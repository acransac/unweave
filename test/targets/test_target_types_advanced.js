const array = [];

const typedarray = new Uint32Array();

const clampedTypedarray = new Uint8ClampedArray();

const arrayBuffer = new ArrayBuffer(5);

const dataView = new DataView(arrayBuffer, 1);

const promise = Promise.resolve(1);

const map = new Map();

const set = new Set();

const proxy = new Proxy({}, {get: () => {}});

const sharedArray = new SharedArrayBuffer();
