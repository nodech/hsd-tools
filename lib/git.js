/*!
 * git.js - git utilities
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/handshake-org/hsd
 */

'use strict';

const assert = require('assert');
const util = require('util');
const childProcess = require('child_process');
const exec = util.promisify(childProcess.exec);
const {Semaphore} = require('./semaphore');

const git = exports;

// Limit git requests to 1 at a time.
const sem = new Semaphore(1);

git.VERSION_REGEX = /^v\d+\.\d+\.\d+(-rc\.\d+)?$/;

/**
 * Clones the repository
 * @param {String} repo - repository url.
 * @param {String} dest - where to store.
 * @returns {Promise}
 */

git.cloneRepo = function cloneRepo(repo, dest) {
  const cmd = `git clone ${repo} ${dest}`;

  return sem.do(async () => exec(cmd));
};

/**
 * Checkout specific tag or branch
 * @param {String} dir - repository directory
 * @param {String} chto - checkout to
 * @returns {Promise}
 */

git.checkout = function checkout(dir, chto) {
  const cmd = `git checkout ${chto}`;

  return exec(cmd, {
    cwd: dir
  });
};

/**
 * List remote objects
 * @param {String} url - repository url.
 * @returns {Promise<Object>}
 */

git.lsRemote = async function lsRemote(url) {
  const cmd = `git ls-remote ${url}`;
  const {stdout} = await sem.do(async () => exec(cmd));

  const items = stdout.trim().split('\n');
  const info = {
    master: null,
    branches: {},   // heads
    tags: {},
    pulls: {}
  };

  for (const rawItem of items) {
    const [hash, ref] = rawItem.split('\t');

    if (ref.startsWith('refs/tags/')) {
      let version = ref.replace('refs/tags/', '');

      if (version.endsWith('^{}'))
        version = version.replace('^{}', '');

      if (!info.tags[version])
        info.tags[version] = [];

      info.tags[version].push(hash);

      continue;
    } else if (ref.startsWith('refs/heads')) {
      const branch = ref.replace('refs/heads/', '');
      info.branches[branch] = hash;
      continue;
    } else if (ref.startsWith('refs/pull/')) {
      const regex = /^refs\/pull\/(\d+)\/.*$/;
      const match = ref.match(regex);

      if (!match || !match[1]) {
        // unknown format ?
        continue;
      }

      const id = match[1];
      info.pulls[id] = ref;
      continue;
    }

    // unknown ref type
  }

  info.master = info.branches.master;
  return info;
};

/**
 * Check if this is url
 * @param {String} url
 * @returns {Boolean}
 */

git.isGitUrl = function isGitUrl(url) {
  const gitUrl = GitUrl.fromURL(url);

  if (gitUrl.isNull())
    return false;

  return true;
};

/**
 * Get package name from url.
 * @param {String} url
 * @param {String} - package name
 */

git.getPKGName = function getPKGName(url) {
  url = GitUrl.fromURL(url);

  return url.repository;
};

/**
 * Is Version
 * @param {String} version
 * @returns {Boolean}
 */

git.isVersion = function isVersion(version) {
  return git.VERSION_REGEX.test(version);
};

/**
 * Is alias
 * @param {String} alias
 * @returns {Boolean}
 */

git.isAlias = function isAlias(alias) {
  return !git.isVersion(alias);
};

class GitUrlExtra {
  constructor() {
    this.version = null;
    this.branch = null;
    this.commit = null;
  }

  isNull() {
    return this.version == null
      && this.branch == null
      && this.commit == null;
  }

  /**
   * @param {String} extra
   * @returns {GitUrlExtra}
   */

  fromExtra(extra) {
    if (!extra)
      return this;

    if (extra.startsWith('semver:')) {
      this.version = extra.replace('semver:', '');
      return this;
    }

    if (extra.match(/^[0-9a-f]+$/)) {
      this.commit = extra;
      return this;
    }

    this.branch = extra;
    return this;
  }

  /**
   * Convert to string for the URL Extra
   * @param {Boolean} prefix - whether to include #
   * @returns {String}
   */

  toExtraString(prefix) {
    const pre = prefix ? '#' : '';

    if (this.isNull())
      return '';

    if (this.version != null)
      return `${pre}semver:${this.version}`;

    if (this.commit != null)
      return `${pre}${this.commit}`;

    if (this.branch != null)
      return `${pre}${this.branch}`;

    return '';
  }

  static fromExtra(extra) {
    return new this().fromExtra(extra);
  }
}

class GitUrl {
  constructor() {
    this.server = null;
    this.owner = null;
    this.repository = null;
    this.extra = null;
  }

  isNull() {
    return this.server == null
      && this.owner == null
      && this.repository == null;
  }

  isPartial() {
    return this.server == null
      || this.owner == null
      || this.repository == null;
  }

  /**
   * @param {String} pkgUrl
   * @returns {GitUrl}
   */

  fromURL(pkgURL) {
    assert(typeof pkgURL === 'string');
    const [url, extra] = pkgURL.split('#');
    const regex = /^(?:git\+)?https:\/\/([^\/]+)\/([^\/]+)\/(.*?)(.git)?$/;

    const match = url.match(regex);

    if (!match)
      return this;

    if (!match[1] || !match[2] || !match[3])
      return this;

    this.server = match[1];
    this.owner = match[2];
    this.repository = match[3];
    this.extra = GitUrlExtra.fromExtra(extra);

    return this;
  }

  toBareURL(scheme) {
    const pre = scheme ? `${scheme}://` : '';

    return `${pre}${this.server}/${this.owner}/${this.repository}`;
  }

  toHTTP() {
    assert(!this.isPartial(), 'Can not construct url.');

    return this.toBareURL('https');
  }

  toHTTPGit() {
    assert(!this.isPartial(), 'Can not construct url.');

    return `${this.toBareURL('https')}.git`;
  }

  toDependencyURL() {
    assert(!this.isPartial(), 'Can not construct url.');

    const extra = this.extra.toExtraString(true);

    return `${this.toBareURL('git+https')}${extra}`;
  }

  static fromURL(url) {
    return new this().fromURL(url);
  }
}

git.GitUrl = GitUrl;
git.GitUrlExtra = GitUrlExtra;
