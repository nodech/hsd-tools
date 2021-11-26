'use strict';

const common = require('./common');
const assert = require('assert');
const path = require('path');
const fs = require('bfile');
const Logger = require('blgr');
const {Lock} = require('bmutex');

class PackagesError extends Error {}

class Packages {
  constructor(options) {
    this.packagesRoot = common.ROOT;
    this.packagesLoc = common.PACKAGES;
    this.packageInfoLoc = common.PACKAGE_INFO;
    this.packagesLockFile = common.PACKAGES_LOCK;

    this.packageInfo = null;
    this.packages = new Set();

    this.closed = true;
    this.locker = new Lock();

    this.logger = new Logger();

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');

    if (options.root != null) {
      assert(typeof options.root === 'string');
      this.packagesRoot = options.root;
      this.packagesLoc = path.join(this.packagesRoot, 'packages');
      this.packageInfoLoc = path.join(this.packagesRoot, 'package-info.json');
      this.packagesLockFile = path.join(this.packagesRoot, '.LOCK');
    }

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }
  }

  init() {
    this.logger = new Logger();

    logger.set({

    });
  }

  async ensure() {
    await this.ensurePackages();
    await this.ensurePackageInfo();
  }

  async ensurePackages() {
    const exists = await fs.exists(this.packagesLoc);

    if (!exists)
      await fs.mkdir(this.packagesLoc);

    const stats = await fs.stats(this.packagesLoc);

    if (!stats.isDirectory())
      throw new PackagesError(`${this.packagesLoc} is a file not a dir.`);
  }

  async ensurePackageInfo() {
    const exists = await fs.exists(this.packageInfoLoc);

    if (!exists) {
      const json = {
        version: common.PACKAGE_INFO_VERSION
      };

      await fs.writeJSON(this.packageInfoLoc, {
        version: common.PACKAGE_INFO_VERSION
      });

      this.packageInfo = json;
    }
  }

  async open() {
    if (!this.closed)
      return;

    await this.logger.open();
    await this.fileLock();
    this.closed = false;
  }

  async close() {
    if (this.closed)
      return;

    await this.fileUnlock();
    await this.logger.close();
    this.closed = true;
  }

  async fileLock() {
    if (!await fs.exists(this.packagesLockFile)) {
      this.logger.debug('Creating lock file..');
      await fs.writeFile(this.packagesLockFile, '');
      return;
    }

    throw new PackagesError('Another process is running...\n'
      + `If not, remove: ${this.packagesLockFile}`);

    // await new Promise((resolve, reject) => {
    //   this.logger.debug('Waiting for another process.');
    //   fs.watch(this.packagesLockFile, (etype) => {
    //     if (etype === 'rename')
    //       resolve();
    //   });
    // });

    // this.logger.debug('Creating lock file..');
    // await fs.writeFile(this.packagesLockFile, '');
  }

  async fileUnlock() {
    this.logger.debug('Removing lock file.');
    await fs.remove(this.packagesLockFile);
  }
}

exports.Packages = Packages;
exports.PackagesError = PackagesError;
