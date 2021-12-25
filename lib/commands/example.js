/*!
 * commands/example.js - example command.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {Command} = require('./command');
const {STATUS} = require('../common');
const {RUNNING, DONE} = STATUS;
const {Semaphore} = require('../semaphore');

const T_CHECK_REMOTES = 'Check remotes';
const T_CHECK_REMOTES_2 = 'Check remotes 2';
const S_FETCH_GIT = 'Fetch git repo';
const S_FETCH_GIT_2 = 'Fetch git repo 2';
const S_FETCH_GIT_3 = 'Fetch git repo 3';
const S_FETCH_NPM = 'Fetch npm repo';

const T_VERIFY_DEPS = 'Verify deps';
const S_VERIFY = d => `Verify dep ${d}`;

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
    this.start(T_CHECK_REMOTES);

    const steps = [S_FETCH_NPM, S_FETCH_GIT];
    for (const step of steps)
      this.step(step);

    const sem = new Semaphore(1);
    const promises = [];
    for (const step of steps) {
      promises.push(sem.do(async () => {
        this.step(step, RUNNING);
        await timeout();
        this.step(step, DONE);
      }));
    }

    await Promise.all(promises);
    this.task(T_CHECK_REMOTES, DONE);
  }

  async checkRemotes2() {
    this.start(T_CHECK_REMOTES_2);

    const steps = [S_FETCH_NPM, S_FETCH_GIT, S_FETCH_GIT_2, S_FETCH_GIT_3];
    for (const step of steps)
      this.step(step);

    const sem = new Semaphore(2);

    const promises = [];
    for (const step of steps) {
      promises.push(sem.do(async () => {
        this.step(step, RUNNING);
        await timeout();
        this.step(step, DONE);
      }));
    }

    await Promise.all(promises);
    this.task(T_CHECK_REMOTES_2, DONE);
  }

  async verifyDeps() {
    this.start(T_VERIFY_DEPS);

    const deps = [
      'dep1',
      'dep2',
      'dep3',
      'dep4',
      'dep5'
    ];

    for (const dep of deps)
      this.step(S_VERIFY(dep));

    const sem = new Semaphore(2);
    const promises = [];
    for (const dep of deps) {
      promises.push(sem.do(async () => {
        this.step(S_VERIFY(dep), RUNNING);
        await timeout();
        this.step(S_VERIFY(dep), DONE);
      }));
    }

    await Promise.all(promises);
    this.done(T_VERIFY_DEPS);
  }

  async run() {
    this.task(T_CHECK_REMOTES);
    this.task(T_VERIFY_DEPS);
    this.task(T_CHECK_REMOTES_2);

    await this.checkRemotes();
    await this.verifyDeps();
    await this.checkRemotes2();
  }
}

exports.ExampleCommand = ExampleCommand;
