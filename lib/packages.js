/*!
 * packages.js - manager.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const common = require('./common');
const assert = require('assert');
const path = require('path');
const fs = require('bfile');
const Logger = require('blgr');
const {Lock} = require('bmutex');

const util = require('./util');
const git = require('./git');
const npm = require('./npm');

const {PackagesInfo} = require('./package');

class PackagesError extends Error {}

class Packages {
  constructor(options) {
    this.projectName = 'default';
    this.packagesRoot = common.ROOT;
    this.packagesLoc = common.PACKAGES;
    this.packageInfoLoc = common.PACKAGE_INFO;
    this.packagesLockFile = common.PACKAGES_LOCK;

    this.logger = new Logger();

    this.pkgInfo = new PackagesInfo();

    this.closed = true;
    this.locker = new Lock();

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');

    let project = 'default';
    let root = common.ROOT;

    if (options.root != null) {
      assert(typeof options.root === 'string');
      root = options.root;
    }

    if (options.project != null) {
      assert(typeof options.project === 'string');
      project = options.project;
    }

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }

    this.projectName = project;
    this.packagesRoot = path.join(root, this.projectName);
    this.packagesLoc = path.join(this.packagesRoot, 'packages');
    this.packageInfoLoc = path.join(this.packagesRoot, 'packages-info.json');
    this.packagesLockFile = path.join(this.packagesRoot, '.LOCK');
  }

  async ensure() {
    await this.ensurePackages();
    await this.ensurePackageInfo();
  }

  async ensurePackages() {
    if (!await fs.exists(this.packagesLoc))
      await fs.mkdirp(this.packagesLoc);
  }

  async ensurePackageInfo() {
    const exists = await fs.exists(this.packageInfoLoc);

    if (!exists)
      await this.packagesWrite();
  }

  async open() {
    if (!this.closed)
      return;

    await this.logger.open();
    await this.fileLock();
    this.closed = false;

    await this.packagesLoad();
  }

  async close() {
    if (this.closed)
      return;

    if (this.pkgInfo.modified)
      await this.packagesWrite();

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

  async packagesLoad() {
    let json;
    try {
      json = await fs.readJSON(this.packageInfoLoc);
    } catch (e) {
      throw new PackagesError(`Could not read/parse ${this.packageInfoLoc}.`);
    }
    this.pkgInfo = PackagesInfo.fromJSON(json);
  }

  async packagesWrite() {
    await fs.writeJSON(this.packageInfoLoc, this.pkgInfo);
  }

  /**
   * Do we track package already?
   * @param {String} pkg - name
   * @return {Boolean}
   */

  hasPackage(pkg) {
    return this.pkgInfo.hasPackage(pkg);
  }

  /**
   * Add package and its dependencies.
   * @param {String} pkg - git link or npm name.
   * @param {Boolean} silent
   * @returns {Promise}
   */

  async addPackage(pkg, silent) {
    if (!silent)
      return this._addPackage(pkg);

    try {
      return await this._addPackage(pkg);
    } catch (e) {
      this.logger.debug('Failed to add package.');
      this.logger.error(e.message);
      return this;
    }
  }

  /**
   * Adds packages and its dependencies.
   * @param {String} pkg - git link to clone via HTTPS.
   * @returns {Promise}
   */

  async _addPackage(pkg) {
    const pkgName = util.getPackageName(pkg);

    if (!pkgName)
      throw new PackagesError('Could not get package name.');

    if (this.hasPackage(pkgName))
      throw new PackagesError('Package is already beeing tracked.');

    if (git.isGitUrl(pkg)) {
      const pkgName = await this.addGitPackage(pkg);

      this.logger.debug('Refresh git and npm packages.');
      await this.refreshPackage(pkgName);
      return this;
    }

    if (npm.isNpmPackage(pkg)) {
      await this.addNPMPackage(pkg);
      return this;
    }

    return this;
  }

  /**
   * Add package from git
   * @private
   * @param {String} url
   * @returns {Promise<String>} - package name
   */

  async addGitPackage(url) {
    const gurl = git.GitUrl.fromURL(url);
    const cloneURL = gurl.toHTTPGit();
    const directory = this.getPackageLoc(gurl.repository);

    // clean up packages of leftover stuff
    if (await fs.exists(directory)) {
      this.logger.debug(`Directory ${directory} exists, rimraf..`);
      await fs.rimraf(directory);
    }

    this.logger.debug(`Cloning ${cloneURL} to ${directory}.`);
    await git.cloneRepo(cloneURL, directory);

    const pkgjsonLoc = this.getPackageJSONLoc(gurl.repository);

    if (!await fs.exists(pkgjsonLoc)) {
      this.logger.error('Could not find package.json');
      await this.removePackage(gurl.repository, false, true);
      throw new PackagesError('Could not find package.json\n'
        + `path: ${pkgjsonLoc}`);
    }

    const pkgjson = await fs.readJSON(pkgjsonLoc);
    const packageName = pkgjson.name;

    // currently we need to be strict.
    if (packageName !== gurl.repository) {
      this.logger.error('package name does not match directory name.');
      await this.removePackage(gurl.repository, false, true);
      throw new PackagesError('Package name does not match directory name.\n'
        + `  dir: ${gurl.repository}, pkg name: ${packageName}.`);
    }

    this.pkgInfo.addPackage({
      name: packageName,
      gitURL: git.GitUrl.fromURL(gurl.toHTTP()),
      dependencies: pkgjson.dependencies,
      devDependencies: pkgjson.devDependencies
    });

    return packageName;
  }

  /**
   * Add package from npm
   * @private
   * @param {String} pkgName
   * @returns {Promise}
   */

  async addNPMPackage(pkgName) {
    // throw new Error('Not implemented.');
  }

  /**
   * Remove package
   * @param {String} pkgName
   * @param {Boolean} deps
   * @param {Boolean} silent
   * @returns {Promise}
   */

  async removePackage(pkgName, deps, silent) {
    if (!silent)
      return this._removePackage(pkgName, deps);

    try {
      return await this._removePackage(pkgName, deps);
    } catch (e) {
      this.logger.debug('Remove package failed.');
      this.logger.error(e.message);
      return this;
    }
  }

  /**
   * Remove package.
   * TODO: Fails if it is depended on and does not remove
   * dependencies if they are depended on.
   * @param {String} pkgName
   * @param {Boolean} deps
   * @returns {Promise}
   */

  async _removePackage(pkgName, deps) {
    const pkgdir = this.getPackageLoc(pkgName);

    if (await fs.exists(pkgdir)) {
      this.logger.debug(`Rimraf ${pkgdir}.`);
      await fs.rimraf(pkgdir);
    }

    this.pkgInfo.removePackage(pkgName);
  }

  /**
   * Refresh package. Fetch information from git and npm.
   * @param {String} pkgName
   * @param {Boolean} silent
   * @returns {Promise<Boolean>}
   */

  async refreshPackage(pkgName, silent) {
    if (!silent)
      return this._refreshPackage(pkgName);

    try {
      return await this._refreshPackage(pkgName);
    } catch (e) {
      this.logger.debug('Refresh package failed.');
      this.logger.error(e.message);
      return false;
    }
  }

  /**
   * Refresh package. Fetch information from git and npm.
   * @param {String} pkgName
   * @returns {Promise<Boolean>}
   */

  async _refreshPackage(pkgName) {
    assert(this.hasPackage(pkgName), 'Could not find package.');

    const git = await this.refreshGitPackage(pkgName);
    const npm = await this.refreshNPMPackage(pkgName);

    return npm && git;
  }

  /**
   * Fetch information from git.
   * @private
   * @param {String} pkgName
   * @returns {Promise<Boolean>}
   */

  async refreshGitPackage(pkgName) {
    assert(this.hasPackage(pkgName), 'Could not find package.');

    this.logger.debug(`Refreshing ${pkgName}`);

    const pkg = this.pkgInfo.getPackage(pkgName);
    const remotes = pkg.gitRemotes;

    for (const remoteName of remotes.keys())
      await this.refreshGitPackageRemote(pkgName, remoteName);

    return true;
  }

  /**
   * Fetch information from specific remote.
   * @private
   * @param {String} pkgName
   * @param {String} remoteName
   * @returns {Promise<Boolean>}
   */

  async refreshGitPackageRemote(pkgName, remoteName) {
    assert(this.hasPackage(pkgName), 'Could not find package.');

    const pkg = this.pkgInfo.getPackage(pkgName);
    const remote = pkg.getRemote(remoteName);
    const url = remote.getFetchURL();

    this.logger.debug(`Refreshing ${remoteName} of ${pkgName}...`);
    const info = await git.lsRemote(url);
    remote.updateLSRemote(info);
    this.pkgInfo.modified = true;
    this.logger.debug(`Updated ${remoteName} of ${pkgName}.`);

    return true;
  }

  /**
   * Fetch information from npm.
   * @param {String} pkgName
   * @returns {Promise}
   */

  refreshNPMPackage(pkgName) {
    assert(this.hasPackage(pkgName), 'Could not find package.');

    // throw new Error('Not implemented.');
  }

  /**
   * Remove package and its dependencies.
   * @param {String} package - name of the package to remove.
   * @param {Boolean} deps - try remove deps or not.
   * @returns {Promise}
   */

  async removePackage(pkg, deps) {
    ;
  }

  /**
   * Download all packages from packages-info.json
   * @returns {Promise}
   */

  async clonePackages() {
    ;
  }

  /**
   * Fetch origin for all packages in packages-info.json.
   * @returns {Promise}
   */

  async fetchPackages() {
    ;
  }

  /**
   * Show package information
   * @param {String} package - package name.
   * @returns {Promise<Object>}
   */

  async packageInfo(pkg) {
    ;
  }

  /**
   * Show updatable dependencies
   * @returns {Promise<Object>}
   */

  async showUpdatabe(pkg) {
    ;
  }

  /**
   * Update dependency version.
   * @param {String} dependency - name of the package.
   * @returns {Promise}
   */

  async updateDependency(pkg) {
    ;
  }

  /*
   * Some location utils
   */

  /**
   * Get location of the package.
   * @param {String} pkgName
   * @returns {String}
   */

  getPackageLoc(pkgName) {
    return path.join(this.packagesLoc, pkgName);
  }

  /**
   * Get package lock location.
   * @param {String} pkgName
   * @returns {String}
   */

  getPackageJSONLoc(pkgName) {
    return path.join(this.getPackageLoc(pkgName), 'package.json');
  }
}

exports.Packages = Packages;
exports.PackagesError = PackagesError;
