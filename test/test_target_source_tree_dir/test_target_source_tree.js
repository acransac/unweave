const import1 = require('./test_target_source_tree_subdir/test_target_source_tree_imports.js');

const import2 = require('../test_target_source_tree_imports.js');

const a = import1 + import2;
