/*!
 * api/npm.js - Cached version of the NPM API.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const {API} = require('./api');
const npm = require('./npm-low');

class NPMAPI extends API {
  constructor(options) {
    super(options);

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
  }
}

exports.NPMAPI = NPMAPI;
