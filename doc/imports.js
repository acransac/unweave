function multiplyBy(n, transform) {
  const multiplicator = transform ? transform(n) : successor(n);

  return p => p * multiplicator;
}

function successor(n) {
  return n + 1;
}

module.exports = { multiplyBy };
