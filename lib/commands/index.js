/*!
 * commands/index.js - commands list.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {ExampleCommand} = require('./example');
const {GitPRLog} = require('./git-prlog');

const gitCommands = {
  'git prlog': GitPRLog
};

const commands = {
  'example': ExampleCommand,

  ...gitCommands
};

exports.commands = commands;
