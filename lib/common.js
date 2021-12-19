/*!
 * common.js - common things for cli and etc.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const common = exports;

common.STATUS = {
  STOPPED: 0,
  RUNNING: 1,
  FAILED: 2,
  SKIPPED: 3,
  DONE: 4
};

common.statusByID = [
  'STOPPED',
  'RUNNING',
  'FAILED',
  'SKIPPED',
  'DONE'
];
