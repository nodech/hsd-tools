/*!
 * api/github.js - Cached version of the APIs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {API} = require('./api');
const github = require('./github-low');
const {fetchCached} = require('../utils/fetch');
const {Semaphore} = require('../utils/semaphore');
const {T_HOUR} = require('../cache');

const GITHUB_CACHE = 'github';
const CACHE_PULL = (owner, repo, pr) => {
  return `${owner}-${repo}-pulls/pull-${pr}.json`;
};
const REPO_TAGS = (owner, repo) => {
  return `${owner}-${repo}-tags.json`;
};
const MASTER_REF = (owner, repo) => {
  return `${owner}-${repo}-master-ref.json`;
};
const TAG_REF_INFO = (owner, repo, hash) => {
  return `${owner}-${repo}-${hash}-sha.json`;
};

class GithubAPI extends API {
  constructor(options) {
    super(options);

    this.ghuser = '';
    this.ghkey = '';

    this.auth = github.USER_CONFIG;

    // by default, only 1 parallel requests are allowed.
    this.semaphore = new Semaphore(1);

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);
    assert(typeof options.ghuser === 'string');
    assert(typeof options.ghkey === 'string');

    if (options.ghuser != null) {
      assert(typeof options.ghuser === 'string');
      this.ghuser = options.ghuser;
    }

    if (options.ghkey != null) {
      assert(typeof options.ghkey === 'string');
      this.ghkey = options.ghkey;
    }

    if (options.ghconc != null) {
      assert(typeof options.ghconc === 'number');
      this.semaphore = new Semaphore(options.ghconc);
    }

    this.auth = {
      username: this.ghuser,
      password: this.ghkey
    };
  }

  /**
   * Get Pull Request info.
   * @param {String} owner
   * @param {String} repo
   * @param {Number} pr - PR number
   * @returns {Promise<[Object, Boolean]>} - json, cached?
   */

  async getPRInfo(owner, repo, pr) {
    const httpOpts = {
      ...this.auth,
      ...github.getPR(owner, repo, pr)
    };

    return fetchCached(this.cache, {
      cacheName: GITHUB_CACHE,
      fileName: CACHE_PULL(owner, repo, pr),
      expire: json => json.merged_at ? 0 : 24 * T_HOUR,
      Error: this.Error,
      semaphore: this.semaphore,
      ...httpOpts
    });
  }

  /**
   * Get repository tags.
   * @param {String} owner
   * @param {String} repo
   * @returns {Promise<Object>}
   */

  async getRepoTags(owner, repo) {
    const httpOpts = {
      ...this.auth,
      ...github.getRepoTags(owner, repo)
    };

    return fetchCached(this.cache, {
      cacheName: GITHUB_CACHE,
      fileName: REPO_TAGS(owner, repo),
      expire: 24 * T_HOUR,
      Error: this.Error,
      semaphore: this.semaphore,
      ...httpOpts
    });
  }

  /**
   * Get master ref.
   * @param {String} owner
   * @param {String} repo
   * @returns {Promise<[Object, Boolean]>} - response, cached
   */

  async getMasterRef(owner, repo) {
    const httpOpts = {
      ...this.auth,
      ...github.getMasterRef(owner, repo)
    };

    return fetchCached(this.cache, {
      cacheName: GITHUB_CACHE,
      fileName: MASTER_REF(owner, repo),
      expire: 24 * T_HOUR,
      Error: this.Error,
      semaphore: this.semaphore,
      ...httpOpts
    });
  }

  /**
   * Get tag ref info
   * @param {String} owner
   * @param {String} repo
   * @returns {Promise<[Object, Boolean]>} - response, cached
   */

  async getTagRefInfo(owner, repo, hash) {
    const httpOpts = {
      ...this.auth,
      ...github.getTagRefInfo(owner, repo, hash)
    };

    return fetchCached(this.cache, {
      cacheName: GITHUB_CACHE,
      fileName: TAG_REF_INFO(owner, repo, hash),
      expire: 24 * T_HOUR,
      Error: this.Error,
      semaphore: this.semaphore,
      ...httpOpts
    });
  }
}

exports.GithubAPI = GithubAPI;
