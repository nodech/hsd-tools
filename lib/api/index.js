/*!
 * api/index.js - Cached version of the APIs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {CLIError} = require('../errors');
const {NullCache, T_HOUR} = require('../cache');
const npm = require('./npm');
const git = require('./git');

const GIT_CACHE = 'git';
const GIT_LS_REMOTE = name => `ls-remote-${name}.json`;

class API {
  constructor(options) {
    this.cache = new NullCache();
    this.cwd = '/';
    this.Error = CLIError;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.cwd === 'string');
    assert(typeof options.cache === 'object');

    this.cwd = options.cwd;
    this.cache = options.cache;

    if (options.Error != null) {
      assert(typeof options.Error === 'function');
      this.Error = options.Error;
    }

    return this;
  }
}

class GitAPI extends API {
  constructor(options) {
    super(options);

    this.remote = 'origin';

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);

    if (options.remote != null) {
      assert(typeof options.remote === 'string');
      this.remote = options.remote;
    }
  }

  /**
   * Get commit hash and message
   * No Cache
   * @returns {Promise<Object[]>}
   */

  getMiniLog() {
    // Make sure message is always last.
    const format = '%H|%s';

    return git.log(this.cwd, {
      pretty: format
    });
  }

  /**
   * Get merge commits
   * No Cache
   * @returns {Promise<Set<String>}
   */

  getMergeCommits() {
    return git.log(this.cwd, {
      merges: true
    });
  }

  /**
   * Get remote info
   * @returns {Object} - remote object
   */

  async lsRemote() {
    const cacheName = GIT_CACHE;
    const fileName = GIT_LS_REMOTE(this.remote);

    const cached = await this.cache.getCache(cacheName, fileName);

    if (cached != null)
      return JSON.parse(cached);

    let result;
    try {
      result = await git.lsRemote(this.remote);
    } catch (e) {
      throw new this.Error(
        `git command "${e.cmd}" failed:\n`
        + `  ${e.stderr}`);
    }

    const data = JSON.stringify(result, null, 2);
    await this.cache.cache(cacheName, fileName, data, T_HOUR * 2);

    return result;
  }
}

class GithubAPI extends API {
  constructor(options) {
    super(options);

    this.ghuser = '';
    this.ghkey = '';

    if (options)
      this.fromOptions();
  }

  fromOptions(options) {
    assert(typeof options.ghuser === 'string');
    assert(typeof options.ghkey === 'string');

    this.ghuser = options.ghuser;
    this.ghkey = options.ghkey;
  }
}

class NPMAPI extends API {
  constructor(options) {
    super(options);
  }
}

exports.GitAPI = GitAPI;
exports.GithubAPI = GithubAPI;
exports.NPMAPI = NPMAPI;
