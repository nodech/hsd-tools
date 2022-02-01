/*!
 * api/github.js - Cached version of the APIs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const brq = require('brq');
const {API} = require('./api');
const github = require('./github-low');
const {Semaphore} = require('../utils/semaphore');
const {T_HOUR} = require('../cache');

const GITHUB_CACHE = 'github';
const CACHE_PULL = (owner, repo, pr) => {
  return `${owner}-${repo}-pulls/pull-${pr}.json`;
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
   * Rate limit
   * @param {Object} opts - Fetch options.
   * @returns {Promise<[Object, Boolean]>} - json, cached?
   */

  async fetch(opts) {
    return this.semaphore.do(async () => {
      return this._fetch(opts);
    });
  }

  /**
   * Non-rate limited fetch
   * @param {Object} opts - Fetch options.
   * @returns {Promise<Object?>} - json?
   */

  async _fetch(opts) {
    let res = null;

    try {
      res = await brq({
        ...this.auth,
        ...opts
      });
    } catch (e) {
      throw new this.Error(`Failed request ${opts.method} for ${opts.url}.\n`
        + e.message);
    }

    if (res.statusCode === 404)
      return null;

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const msg = res.json().message;
      throw new this.Error(`Received wrong status code: ${res.statusCode},`
        + ` message: ${msg}`);
    }

    try {
      return res.json();
    } catch (e) {
      throw new this.Error('Failed to deserialize response to JSON.');
    }
  }

  /**
   * Get Pull Request info.
   * @param {String} owner
   * @param {String} repo
   * @param {Number} pr - PR number
   * @returns {Promise<[Object, Boolean]>} - json, cached?
   */

  async getPRInfo(owner, repo, pr) {
    const cacheName = GITHUB_CACHE;
    const fileName = CACHE_PULL(owner, repo, pr);

    const cached = await this.cache.getCache(cacheName, fileName);

    if (cached != null)
      return [JSON.parse(cached), true];

    const opts = github.getPR(owner, repo, pr);
    let json = null;

    try {
      json = await this.fetch(opts);
    } catch (e) {
      return [null, false];
    }

    let expire = 24 * T_HOUR;

    // we don't expire merged PR cache.
    if (!json || json.merged_at)
      expire = 0;

    const raw = JSON.stringify(json, null, 2);

    await this.cache.cache(cacheName, fileName, raw, expire);

    return [json, false];
  }
}

exports.GithubAPI = GithubAPI;
