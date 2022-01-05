/*!
 * api/api.js - Common caching.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {CLIError} = require('../errors');
const {NullCache} = require('../cache');

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

exports.API = API;
