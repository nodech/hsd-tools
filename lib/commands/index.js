/*!
 * commands/index.js - commands list.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {ExampleCommand} = require('./example');
const {GitPRLog} = require('./git-prlog');
const {DependencyCheck} = require('./depcheck');
const {GenerateSeeds} = require('./genseeds');

const gitCommands = {
  'git prlog': GitPRLog
};

const commands = {
  'example': ExampleCommand,

  // hsd network related.
  'genseeds': GenerateSeeds,

  'depcheck': DependencyCheck,

  ...gitCommands
};

exports.commands = commands;
