/**
 * This file is the entry point to loading test files to the browser tests.
 * This module selects the test files to be included in the test build.
 * By default it looks at the test/ -directory and includes all *.spec.js -files
 *
 * To pick only an individual test file for the browser testing, modify this file, not the build scripts!
 */
import "./helpers/logger";

const requireAll = (requireContext: any) => { requireContext.keys().map(requireContext); };

declare var require: any;
requireAll(require.context("./helpers/", true, /\.ts$/));
//requireAll(require.context("./", true, /[sS]pec\.ts$/));
requireAll(require.context("./", true, /01-VideoPlayer.[sS]pec\.ts$/));
