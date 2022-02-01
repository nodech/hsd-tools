/*!
 * lockfile.js - Lock File.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const path = require('path');
const fs = require('bfile');

// A second.
const A_SECOND = 1000;
const WAIT = A_SECOND * 2 + 500;
const MAX_TRIES = 4;

class LockFile {
  constructor(dirname, maxTries) {
    this.dirname = dirname;
    this.filename = path.join(this.dirname, 'LOCK');

    this.maxTries = maxTries || MAX_TRIES;
    this.tries = 0;
    this.updateInterval = null;
  }

  async open() {
    if (!await this.tryAcquire())
      return false;

    this.update();
    this.updateInterval = setInterval(() => this.update(), A_SECOND);

    if (this.updateInterval.unref)
      this.updateInterval.unref();

    return true;
  }

  async close() {
    clearInterval(this.updateInterval);
    await this.unlink();
  }

  async tryAcquire() {
    if (!await fs.exists(this.filename))
      return true;

    for (let i = 0; i < this.maxTries; i++) {
      const now = Date.now();
      const stat = await this.stat();

      if (!stat || stat.mtimeMs + WAIT < now)
        return true;

      await sleep(A_SECOND);
    }

    return false;
  }

  async update() {
    try {
      await this.touch();
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw e;
    }
  }

  async touch() {
    if (await fs.exists(this.filename)) {
      await fs.truncate(this.filename, 0);
      return;
    }

    // Ideally, we could use fcntl F_SETLK to make sure
    // other process can't access it..
    const {O_RDWR, O_CREAT, O_EXCL} = fs.constants;
    const fd = await fs.open(this.filename, O_RDWR | O_CREAT | O_EXCL, 0o640);
    await fs.close(fd);
  }

  async stat() {
    let stat = null;

    try {
      stat = await fs.stat(this.filename);
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw e;
    }

    return stat;
  }

  async unlink() {
    try {
      await fs.unlink(this.filename);
    } catch (e) {
      if (e.code !== 'ENOENT')
        throw e;
    }
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

exports.LockFile = LockFile;
