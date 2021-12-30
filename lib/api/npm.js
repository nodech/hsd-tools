/*!
 * npm.js - npm utilities
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const request = require('brq');

const REGISTRY_URL = 'https://registry.npmjs.org/';
const TIMEOUT = 5000;

const npm = exports;

/**
 * Fetch package info
 * @param {String} pkg - name of the package
 * @returns {Object}
 */

npm.getInfo = async function getInfo(pkg, timeout = TIMEOUT) {
  const url = `${REGISTRY_URL}/${pkg}`;
  const res = await request({ url, timeout });

  return res.json();
};

/**
 * Check if the pkgName could be npm package.
 * @param {String} pkgName
 * @returns {Boolean}
 */

npm.isNpmPackage = function isNpmPackage(pkgName) {
  assert(typeof pkgName === 'string');

  if (pkgName.length > 214)
    return false;

  // this is simplified check, not correct
  // e.g. starting with - etc rules are ommitted.
  const regex = /^(@[0-9a-z-]+\/)?[0-9a-z-_]+$/;

  return regex.test(pkgName);
};
