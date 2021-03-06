// Copyright (c) Adrien Cransac
// License: MIT

(async () => {
  await require('./test_components.js');

  await require('./test_environmenttree.js');

  await require('./test_init.js');

  await require('./test_performance.js');

  await require('./test_processes.js');

  await require('./test_templates.js');
})();
