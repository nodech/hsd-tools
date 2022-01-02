/*!
 * commands/example.js - example command.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {Command} = require('./command');
const {STATUS} = require('../common');
const {RUNNING, DONE} = STATUS;
const {Semaphore} = require('../utils/semaphore');

const TASK_CHECK_REMOTES = 'Check remotes';
const TASK_CHECK_REMOTES_2 = 'Check remotes 2';
const STEP_FETCH_GIT = 'Fetch git repo';
const STEP_FETCH_GIT_2 = 'Fetch git repo 2';
const STEP_FETCH_GIT_3 = 'Fetch git repo 3';
const STEP_FETCH_NPM = 'Fetch npm repo';

const TASK_VERIFY_DEPS = 'Verify deps';
const STEP_VERIFY = d => `Verify dep ${d}`;

function timeout(n) {
  return new Promise((res, rej) => {
    setTimeout(res, n ? n : Math.random() * 5000 + 1000);
  });
}

class ExampleCommand extends Command {
  constructor(options) {
    super(options);

    this.current = '';
  }

  async checkRemotes() {
    this.start(TASK_CHECK_REMOTES, '');

    const steps = [STEP_FETCH_NPM, STEP_FETCH_GIT];
    for (const step of steps)
      this.step(step);

    const sem = new Semaphore(1);
    const promises = [];
    for (const step of steps) {
      promises.push(sem.do(async () => {
        this.step(step, RUNNING, 'Fetching remotes..');
        await timeout();
        this.step(step, DONE, 'Restored from cache.');
      }));
    }

    await Promise.all(promises);
    this.task(TASK_CHECK_REMOTES, DONE, '');
  }

  async checkRemotes2() {
    this.start(TASK_CHECK_REMOTES_2, '');

    const steps = [
      STEP_FETCH_NPM,
      STEP_FETCH_GIT,
      STEP_FETCH_GIT_2,
      STEP_FETCH_GIT_3
    ];

    for (const step of steps)
      this.step(step);

    const sem = new Semaphore(2);

    const promises = [];
    for (const step of steps) {
      promises.push(sem.do(async () => {
        this.step(step, RUNNING, 'Doing some work..');
        await timeout();
        this.step(step, DONE, '');
      }));
    }

    await Promise.all(promises);
    this.task(TASK_CHECK_REMOTES_2, DONE, '');
  }

  async verifyDeps() {
    this.start(TASK_VERIFY_DEPS, '');

    const deps = [
      'dep1',
      'dep2',
      'dep3',
      'dep4',
      'dep5'
    ];

    for (const dep of deps)
      this.step(STEP_VERIFY(dep));

    const sem = new Semaphore(2);
    const promises = [];
    for (const dep of deps) {
      promises.push(sem.do(async () => {
        this.step(STEP_VERIFY(dep), RUNNING, 'Checking npm..');
        await timeout();
        this.step(STEP_VERIFY(dep), DONE, '');
      }));
    }

    await Promise.all(promises);
    this.done(TASK_VERIFY_DEPS);
  }

  async run() {
    this.task(TASK_CHECK_REMOTES, null, 'Waiting..');
    this.task(TASK_VERIFY_DEPS, null, 'Waiting..');
    this.task(TASK_CHECK_REMOTES_2, null, 'Waiting..');

    await this.checkRemotes();
    await this.verifyDeps();
    await this.checkRemotes2();
  }
}

exports.ExampleCommand = ExampleCommand;
