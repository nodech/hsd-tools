/*!
 * cli.js - CLI manager.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const Logger = require('blgr');
const path = require('path');
const fs = require('bfile');

const ansi = require('./ansi');
const {STATUS, statusByID} = require('./common');
const {STOPPED, RUNNING, FAILED, SKIPPED, DONE} = STATUS;
const {commands} = require('./commands');
const {UIRenderer} = require('./ui');

class CLIError extends Error {}

/**
 * @property {String} name
 * @property {Map<String, Number>} steps
 */
class Task {
  constructor(name) {
    this.name = name;
    this.steps = new Map();

    // stats.
    this.stopped = 0;
    this.running = 0;
    this.failed = 0;
    this.skipped = 0;
    this.done = 0;

    this.status = STOPPED;
  }

  addStep(name) {
    this.stopped += 1;
    this.steps.set(name, STOPPED);
  }

  setStepStatus(name, status) {
    const curStatus = this.steps.get(name);

    if (!curStatus)
      this.addStep(name);

    this.steps.set(name, status);

    this.changeStat(curStatus, -1);
    this.changeStat(status, 1);
  }

  changeStat(status, n) {
    switch (status) {
      case STOPPED:
        this.stopped += n;
        break;
      case RUNNING:
        this.running += n;
        break;
      case FAILED:
        this.failed += n;
        break;
      case SKIPPED:
        this.skipped += n;
        break;
      case DONE:
        this.done += n;
        break;
      default:
        throw new Error(`Unknown status ${status}.`);
    }
  }
}

/**
 * CLI runner and reporter
 * @class
 * @property {String} cwd
 * @property {String} cacheDir
 * @property {String} packageJSON
 * @property {Object} logger
 * @property {String} lockFile
 * @property {Map<String, Task>} tasks
 * @property {String[]} out
 */
class CLI {
  constructor(options) {
    this.cwd = '/';
    this.logger = Logger.global;
    this.cacheDir = '';
    this.packageJSON = '';
    this.lockFile = '';

    this.tasks = new Map();
    this.out = [];

    this.renderer = new UIRenderer(process.stdout);

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.cwd === 'string');
    assert(typeof options.logger === 'object');

    this.cwd = options.cwd;
    this.logger = options.logger;
  }

  /**
   * Initialize vars.
   * @returns {void}
   */

  init() {
    this.cacheDir = path.join(this.cwd, '.hs-tools');
    this.packageJSON = path.join(this.cwd, 'package.json');
    this.lockFile = path.join(this.cacheDir, '.lock');
  }

  /**
   * Make sure everything is in place.
   * @returns {Promise}
   */

  async ensure() {
    if (!await fs.exists(this.packageJSON))
      throw new CLIError('Could not find package.json');
  }

  /**
   * Run the command
   * @param {String} cmd - name of the command.
   * @param {Object?} options - options for the command.
   * @returns {Promise}
   */

  async run(cmd, options) {
    const command = new commands[cmd](options);

    // const _on = command.on;
    // command.on = (name, fn) => {
    //   console.log('wrapping: ', name);
    //   _on.call(command, name, (...args) => {
    //     console.error(name, args);
    //     fn(...args);
    //   });
    // };

    command.on('error', (err) => {
      // swallow for now.
    });

    command.on('out', (...args) => {
      this.out.push(...args);
    });

    command.on('task', (name) => {
      this.tasks.set(name, new Task(name));
      this.mustDraw = true;
    });

    command.on('step', (tname, name) => {
      const task = this.tasks.get(tname);
      task.addStep(name);
      this.mustDraw = true;
    });

    for (const statname of statusByID) {
      const status = STATUS[statname];

      command.on(`task ${statname}`, (name) => {
        const task = this.tasks.get(name);
        task.status = status;
        this.mustDraw = true;
      });

      command.on(`step ${statname}`, (tname, name) => {
        const task = this.tasks.get(tname);
        task.setStepStatus(name, status);
        this.mustDraw = true;
      });
    }

    await command.run();
  }

  /**
   * Drawing loop
   * @returns {void}
   */

  done() {
    console.log(...this.out);
  }

  /**
   * Start the drawin loop.
   * @returns {void}
   */
  start() {
    this.interval = setInterval(this.draw.bind(this), 100);
  }

  /**
   * Draw
   */

  draw() {
    this.renderer.draw(this.tasks);
  }

  /**
   * Stop the CLI.
   * @returns {Promise}
   */

  stop() {
    process.stdout.write(ansi.cursor.show);
    if (this.interval)
      clearInterval(this.interval);

    this.draw();
    this.done();
  }
}

exports.CLIError = CLIError;
exports.CLI = CLI;
