/*!
 * npm.js - npm utilities
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');

const REGISTRY_URL = 'https://registry.npmjs.org/';
const TIMEOUT = 5000;

const NPM = exports;

NPM.finalize = function finalize(object) {
  return {
    ...object,
    timeout: TIMEOUT
  };
};

/**
 * Fetch package info
 * @param {String} pkg - name of the package
 * @returns {Object}
 */

NPM.getPkgInfo = function getPkgInfo(pkg) {
  return NPM.finalize({
    method: 'GET',
    url: `${REGISTRY_URL}/${pkg}`
  });
};

/**
 * Check if the pkgName could be npm package.
 * @param {String} pkgName
 * @returns {Boolean}
 */

NPM.isNpmPackage = function isNpmPackage(pkgName) {
  assert(typeof pkgName === 'string');

  if (pkgName.length > 214)
    return false;

  // this is simplified check, not correct
  // e.g. starting with - etc rules are ommitted.
  const regex = /^(@[0-9a-z-]+\/)?[0-9a-z-_]+$/;

  return regex.test(pkgName);
};
