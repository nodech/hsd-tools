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
const STEP_FETCH_GIT = 'Fetch git repo';
const STEP_FETCH_NPM = 'Fetch npm repo';

const TASK_VERIFY_DEPS = 'Verify deps';
const STEP_VERIFY = d => `Verify dep ${d}`;

const TASK_DO_MANY = 'Do many tasks';
const TASK_CHECK_REMOTES_2 = 'Check remotes 2';

function timeout(n) {
  return new Promise((res, rej) => {
    setTimeout(res, n ? n : Math.random() * 1000 + 500);
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

  async doManyTasks() {
    this.start(TASK_DO_MANY, RUNNING);

    const stepName = n => `Step ${n}`;
    const N = 20;
    const P = 2;
    const T = 4000;

    const sem = new Semaphore(P);

    for (let i = 0; i < N; i++)
      this.step(stepName(i));

    const promises = [];
    for (let i = 0; i < N; i++) {
      promises.push(sem.do(async () => {
        this.step(stepName(i), RUNNING);
        await timeout(T * Math.random());
        this.step(stepName(i), DONE);
      }));
    }

    await Promise.all(promises);

    this.done(TASK_DO_MANY);
  }

  async checkRemotes2() {
    this.start(TASK_CHECK_REMOTES_2, '');

    const sem = new Semaphore(2);

    const promises = [];
    for (let i = 0; i < 4; i++) {
      promises.push(sem.do(async () => {
        await timeout();
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
    this.task(TASK_DO_MANY, null, 'Waiting..');
    this.task(TASK_CHECK_REMOTES_2, null, 'Waiting..');

    await this.checkRemotes();
    await this.verifyDeps();
    await this.doManyTasks();
    await this.checkRemotes2();
  }
}

exports.ExampleCommand = ExampleCommand;
