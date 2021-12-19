/*!
 * commands/index.js - commands list.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {TestCommand} = require('./test');

const commands = {
  'test': TestCommand
};

exports.commands = commands;
