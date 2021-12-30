/*!
 * semaphore.js - just do some rate limiting.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('assert');

class SimpleSemaphore {
  constructor(max) {
    assert(max > 0);

    this.jobs = [];
    this.max = max;
    this.active = 0;
  }

  async do(job) {
    return new Promise((resolve, reject) => {
      this.jobs.push([job, resolve, reject]);
      this.execute();
    });
  }

  execute() {
    if (this.active === this.max)
      return;

    this.active++;
    const [job, resolve, reject] = this.jobs.shift();

    job().then((res) => {
      resolve(res);
      this.active--;
      if (this.jobs.length !== 0)
        this.execute();
    }).catch((e) => {
      reject(e);
      this.active--;
      if (this.jobs.length !== 0)
        this.execute();
    });
  }
}

exports.Semaphore = SimpleSemaphore;
