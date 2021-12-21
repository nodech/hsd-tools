/*!
 * commands/test.js - test command.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const {Command} = require('./command');
const {STATUS} = require('../common');
const {STOPPED, RUNNING, FAILED, SKIPPED, DONE} = STATUS;

const T_CHECK_REMOTES = 'Check remotes';
const S_FETCH_GIT = 'Fetch git repo';
const S_FETCH_NPM = 'Fetch npm repo';

const T_VERIFY_DEPS = 'Verify deps';
const S_VERIFY = d => `Verify dep ${d}`;

function timeout(n) {
  return new Promise((res, rej) => {
    setTimeout(res, n ? n : Math.random() * 5000 + 1000);
  });
}

class TestCommand extends Command {
  constructor(options) {
    super(options);

    this.current = '';
  }

  async checkRemotes() {
    this.start(T_CHECK_REMOTES);

    this.step(S_FETCH_NPM);
    this.step(S_FETCH_GIT);

    await Promise.all([
      (async () => {
        this.step(S_FETCH_GIT, RUNNING);
        await timeout();
        this.step(S_FETCH_GIT, DONE);
      })(),
      (async () => {
        this.step(S_FETCH_NPM, RUNNING);
        await timeout();
        this.step(S_FETCH_NPM, DONE);
      })()
    ]);

    this.task(T_CHECK_REMOTES, DONE);
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

    for (const dep of deps) {
      this.step(S_VERIFY(dep), RUNNING);

      await timeout();
      this.step(S_VERIFY(dep), DONE);
    }

    this.done(T_VERIFY_DEPS);
  }

  async run() {
    this.task(T_CHECK_REMOTES);
    this.task(T_VERIFY_DEPS);

    await this.checkRemotes();
    await this.verifyDeps();
  }
}

exports.TestCommand = TestCommand;
