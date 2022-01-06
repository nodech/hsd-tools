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

const git = exports;

git.VERSION_REGEX = /^v\d+\.\d+\.\d+(-rc\.\d+)?$/;

/**
 * Clones the repository
 * @param {String} repo - repository url.
 * @param {String} dest - where to store.
 * @returns {Promise}
 */

git.cloneRepo = function cloneRepo(repo, dest) {
  const cmd = `git clone ${repo} ${dest}`;

  return exec(cmd);
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
 * Get git log
 * @param {String} dir
 * @param {Object} options
 * @returns {Promise<Object[]>}
 */

git.log = function log(dir, options) {
  let cmd = 'git log ';

  if (options.pretty)
    cmd += `--pretty='${options.pretty}'`;

  return exec(cmd, {
    cwd: dir
  });
};

/**
 * Get rev-list.
 * @param {String} dir
 * @param {Object} options
 * @returns {Promise<Set<String>}
 */

git.revList = function revList(dir, options) {
  const cmd = ['git rev-list'];
  let from = 'HEAD';

  if (options.merges)
    cmd.push('--merges');

  if (options.from)
    from = options.from;

  cmd.push(from);

  return exec(cmd.join(' '), {
    cwd: dir
  });
};

/**
 * List fetch remotes.
 * @param {String} cwd
 * @returns {Promise<Map<String, String>>}
 */

git.remotes = async function remotes(cwd) {
  const cmd = 'git remote -v';

  return exec(cmd, { cwd });
};

/**
 * List remote objects.
 * @param {String} url - repository url.
 * @returns {Promise<Object>}
 */

git.lsRemote = async function lsRemote(remote) {
  const cmd = `git ls-remote ${remote}`;
  return exec(cmd);
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
    this.extra = new GitUrlExtra();
  }

  isNull() {
    return this.server == null
      && this.owner == null
      && this.repository == null
      && this.extra.isNull();
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

  fromNPMUrl(pkgURL) {
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

  /**
   * SSH or HTTP
   * @param {String} url
   * @returns {GitUrl}
   */

  fromRemoteURL(url) {
    if (url.startsWith('https'))
      return this.fromNPMUrl(url);

    const regex = /^git@([^:]+):([^\/]+)\/([^\.]+)(\.git)?$/;
    const match = url.match(regex);

    if (!match)
      return this;

    if (!match[1] || !match[2] || !match[3])
      return this;

    this.server = match[1];
    this.owner = match[2];
    this.repository = match[3];

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

  toGitSSH() {
    assert(!this.isPartial(), 'Can not construct url.');

    return `git@${this.server}:${this.owner}/${this.repository}.git`;
  }

  static fromNPMURL(url) {
    return new this().fromNPMUrl(url);
  }

  static fromRemoteURL(url) {
    return new this().fromRemoteURL(url);
  }
}

git.GitUrl = GitUrl;
git.GitUrlExtra = GitUrlExtra;
