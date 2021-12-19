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

    this.current = null;
  }

  start(name) {
    this.current = name;
    this.task(name, RUNNING);
  }

  done(name) {
    this.current = '';
    this.task(name, DONE);
  }

  task(name, status) {
    if (!status) {
      this.emit('task', name);
      return;
    }

    const stname = statusByID[status];
    this.emit(`task ${stname}`, name);
    return;
  }

  step(name, status) {
    if (!status) {
      this.emit('step', this.current, name);
      return;
    }

    const stname = statusByID[status];
    this.emit(`step ${stname}`, this.current, name);
    return;
  }

  log(...args) {
    this.emit('out', ...args, '\n');
  }
}

exports.Command = Command;
