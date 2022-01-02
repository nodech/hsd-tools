/*!
 * commands/command.js - command interface.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const EventEmitter = require('events');

const {STATUS, statusByID} = require('../common');
const {RUNNING, DONE} = STATUS;

class Command extends EventEmitter {
  constructor(options) {
    super();

    this.options = options;
    this.Error = options.Error;
    this.current = null;
  }

  start(name, message) {
    this.current = name;
    this.task(name, RUNNING, message);
  }

  done(name, message) {
    this.current = '';
    this.task(name, DONE, message);
  }

  task(name, status, message) {
    if (!status) {
      this.emit('task', name, message);
      return;
    }

    const stname = statusByID[status];
    this.emit(`task ${stname}`, name, message);
    return;
  }

  step(name, status, message) {
    if (!status) {
      this.emit('step', this.current, name, message);
      return;
    }

    const stname = statusByID[status];
    this.emit(`step ${stname}`, this.current, name, message);
    return;
  }

  log(...args) {
    this.emit('out', ...args, '\n');
  }
}

exports.Command = Command;
