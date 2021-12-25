/*!
 * commands/index.js - commands list.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {ExampleCommand} = require('./example');
const {PRLog} = require('./git-prlog');

const commands = {
  'example': ExampleCommand,
  'git prlog': PRLog
};

exports.commands = commands;
