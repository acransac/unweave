const { multiplyBy } = require('./imports.js');

if (multiplyBy(2)(3) === 6) {
  console.log("Success");
}
else {
  console.log("Failure");
}
