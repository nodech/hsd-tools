/*!
 * log.js - log formats
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const colors = require('./colors');

const _console = exports;

/**
 * Normal log.
 */

_console.log = (...args) => {
  console.log(...args);
};

/**
 * Error log.
 */

_console.error = (...args) => {
  console.error(
    colors.redText('ERR ! '),
    ...args
  );
};
