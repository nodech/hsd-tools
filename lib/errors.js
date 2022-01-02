/*!
 * errors.js - Error types.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

class CLIError extends Error {}

class CommandError extends CLIError {
  constructor(cmdname, message) {
    super(message);

    this.command = cmdname;
  }
}

exports.CLIError = CLIError;
exports.CommandError = CommandError;
