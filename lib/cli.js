/*!
 * cli.js - CLI manager.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('bfile');

const {CLIError, CommandError} = require('./errors');
const ansi = require('./utils/ansi');
const {STATUS, statusByID, CACHE_DIR} = require('./common');
const {STOPPED, RUNNING, FAILED, SKIPPED, DONE} = STATUS;
const {commands} = require('./commands');
const {UIRenderer, TextRenderer} = require('./ui');

class Step {
  constructor(name, status, message) {
    this.name = name || '';
    this.status = status || 0;
    this.message = message || '';
  }
}

/**
 * @property {String} name
 * @property {String} message
 * @property {Map<String, Number>} steps
 */
class Task {
  constructor(name, message) {
    this.name = name;
    this.message = message || '';
    this.steps = new Map();

    // stats.
    this.stopped = 0;
    this.running = 0;
    this.failed = 0;
    this.skipped = 0;
    this.done = 0;

    this.status = STOPPED;
  }

  addStep(name, message) {
    if (this.steps.has(name)) {
      const step = this.steps.get(name);

      if (message != null)
        step.message = message;

      return step;
    }

    const step = new Step(name, STOPPED, message);
    this.stopped += 1;
    this.steps.set(name, step);
    return step;
  }

  setStepStatus(name, status, message) {
    let step = this.steps.get(name);

    if (!step)
      step = this.addStep(name, message);

    if (status === STOPPED && message != null) {
      step.message = message;
      return;
    }

    const oldStat = step.status;
    step.status = status;

    if (message != null)
      step.message = message;

    this.changeStat(oldStat, -1);
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
 * @property {String} lfile - lock file
 * @property {Map<String, Task>} tasks
 * @property {String[]} out
 */
class CLI {
  constructor(options) {
    this.cwd = '/';
    this.cacheDir = '';
    this.packageJSON = '';
    this.lfile = '';
    this.force = false;

    this.tasks = new Map();
    this.out = [];

    this.rendererName = 'loader';
    this.renderer = null;

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.cwd === 'string');
    assert(typeof options.stdout === 'object');
    assert(typeof options.stderr === 'object');

    this.cwd = options.cwd;
    this.stderr = options.stderr;
    this.stdout = options.stdout;

    if (options.renderer != null) {
      assert(typeof options.renderer === 'string');
      this.rendererName = options.renderer;
    }

    if (options.force != null) {
      assert(typeof options.force === 'boolean');
      this.force = options.force;
    }

    return this;
  }

  /**
   * Initialize vars.
   * @returns {void}
   */

  init() {
    this.cacheDir = path.join(this.cwd, CACHE_DIR);
    this.packageJSON = path.join(this.cwd, 'package.json');
    this.lfile = path.join(this.cacheDir, '.lock');

    if (!this.stderr.isTTY)
      this.rendererName = 'text';

    switch (this.rendererName) {
      case 'text':
        this.renderer = new TextRenderer(this.stderr);
        break;
      case 'loader':
        this.renderer = new UIRenderer(this.stderr);
        break;
      default:
        throw new CLIError(`Could not find ${this.rendererName} renderer.`);
    }
  }

  /**
   * Make sure everything is in place.
   * @returns {Promise}
   */

  async ensure() {
    if (!await fs.exists(this.packageJSON))
      throw new CLIError('Could not find package.json');

    if (!await fs.exists(path.join(this.cwd, '.git')))
      throw new CLIError('Could not find git.');
  }

  /**
   * Check or create lock file.
   * @returns {Promise}
   */

  async lockFile() {
    if (this.force)
      return;

    // Ideally, we could use fcntl F_SETLK to make sure
    // other process can't access it..
    const {O_RDWR, O_CREAT, O_EXCL} = fs.constants;
    try {
      await fs.open(this.lfile, O_RDWR | O_CREAT | O_EXCL);
    } catch (e) {
      if (e.code === 'EEXIST') {
        throw new Error('Another process is running.\n'
          + `If not remove: ${this.lfile}.`);
      }

      throw e;
    }
  }

  /**
   * Unlock file
   * @returns {Promise}
   */

  async unlockFile() {
    await fs.unlink(this.lfile);
  }

  /**
   * Run the command
   * @param {String} cmd - name of the command.
   * @param {Object?} options - options for the command.
   * @returns {Promise}
   */

  async run(cmd, options) {
    const command = new commands[cmd]({
      Error: CommandError.bind(null, cmd),
      ...options
    });

    command.on('error', (err) => {
      // swallow for now.
    });

    command.on('out', (...args) => {
      this.out.push(...args);
    });

    command.on('task', (name, message) => {
      if (this.tasks.has(name) && message != null) {
        const task = this.tasks.get(name);
        task.message = message;
        return;
      }

      if (this.tasks.has(name))
        return;

      this.tasks.set(name, new Task(name, message));
      this.renderer.logTask(name, message);
    });

    command.on('step', (tname, name, message) => {
      const task = this.tasks.get(tname);
      task.addStep(name, message);
      this.renderer.logStep(tname, name, message);
    });

    for (const statname of statusByID) {
      const status = STATUS[statname];

      command.on(`task ${statname}`, (name, message) => {
        if (!this.tasks.has(name))
          this.tasks.set(name, new Task(name, message));

        const task = this.tasks.get(name);
        task.status = status;

        if (message != null)
          task.message = message;

        this.renderer.logTask(name, status, message);
      });

      command.on(`step ${statname}`, (tname, name, message) => {
        const task = this.tasks.get(tname);
        task.setStepStatus(name, status, message);
        this.renderer.logStep(tname, name, status, message);
      });
    }

    await command.run();
  }

  /**
   * Drawing loop
   * @returns {void}
   */

  done() {
    if (this.out.length)
      console.log(...this.out);
  }

  /**
   * Start the drawin loop.
   * @returns {Promise}
   */

  async start() {
    await this.lockFile();

    if (this.stdout.isTTY && this.rendererName === 'loader')
      this.stdout.write(ansi.cursor.hide);

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

  async stop() {
    if (this.stdout.isTTY && this.rendererName === 'loader')
      this.stdout.write(ansi.cursor.show);

    if (this.interval)
      clearInterval(this.interval);

    await this.unlockFile();
    this.draw();
    this.done();
  }
}

exports.CLIError = CLIError;
exports.CLI = CLI;
