/*!
 * api/github.js - Cached version of the APIs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {API} = require('./api');
const github = require('./github-low');

class GithubAPI extends API {
  constructor(options) {
    super(options);

    this.ghuser = '';
    this.ghkey = '';

    this.auth = github.USER_CONFIG;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options.ghuser === 'string');
    assert(typeof options.ghkey === 'string');

    this.ghuser = options.ghuser;
    this.ghkey = options.ghkey;

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
   * @returns {Promise<Object>}
   */

  async getPRInfo(owner, repo, pr) {
    const opts = github.getPR(owner, repo, pr);

    console.log(opts);
  }
}

exports.GithubAPI = GithubAPI;
