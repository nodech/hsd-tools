/*!
 * commands/command.js - command interface.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const EventEmitter = require('events');

const {STATUS, statusByID} = require('../common');
const {RUNNING, FAILED, DONE} = STATUS;

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

  registerTasks(tasks) {
    for (const task of tasks)
      this.task(task);
  }

  async runTasks(tasks) {
    for (const [task, fn] of tasks) {
      this.start(task);
      await fn();
      this.done(task);
    }
  }

  registerSteps(steps) {
    for (const step of steps)
      this.step(step);
  }

  async runSeriesSteps(steps) {
    for (const [step, fn] of steps) {
      this.step(step, RUNNING);
      try {
        await fn();
      } catch (e) {
        this.error(e);
        this.step(step, FAILED, e.messae);
        return;
      }
      this.step(step, DONE);
    }
  }

  async runParallelSteps(steps, semaphore) {
    const running = [];

    for (const [step, fn] of steps) {
      running.push(semaphore.do(async () => {
        this.step(step, RUNNING);
        try {
          await fn();
        } catch (e) {
          this.error(e);
          this.step(step, FAILED);
          return;
        }

        this.step(step, DONE);
      }));
    }

    await Promise.all(running);
  }

  error(err, ...args) {
    this.emit('error', err, ...args);
  }

  log(...args) {
    this.emit('out', ...args, '\n');
  }
}

exports.Command = Command;
