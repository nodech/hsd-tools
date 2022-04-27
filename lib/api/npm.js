/*!
 * api/npm.js - Cached version of the NPM API.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {API} = require('./api');
const npm = require('./npm-low');
const {fetchCached} = require('../utils/fetch');
const {Semaphore} = require('../utils/semaphore');
const {T_HOUR} = require('../cache');

class NPMAPI extends API {
  constructor(options) {
    super(options);

    this.semaphore = new Semaphore(2);

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    super.fromOptions(options);

    if (options.npmconc != null) {
      assert(typeof options.npmconc === 'number');
      this.semaphore = new Semaphore(options.npmconc);
    }
  }

  /**
   * Get package information
   * @param {String} pkg
   * @returns {Promise<[Object, Boolean]>}
   */

  async getPkgInfo(pkg) {
    const httpOpts = npm.getPkgInfo(pkg);

    return await fetchCached(this.cache, {
      cacheName: 'package-info',
      fileName: `package-${pkg}.json`,
      expire: 24 * T_HOUR,
      Error: this.Error,
      semaphore: this.semaphore,
      ...httpOpts
    });
  }
}

exports.NPMAPI = NPMAPI;
