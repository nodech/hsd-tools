/*!
 * npm.js - npm utilities
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const assert = require('assert');
const request = require('brq');
const fs = require('bfile');
const {Semaphore} = require('./semaphore');

const REGISTRY_URL = 'https://registry.npmjs.org/';
const TIMEOUT = 20000;

const npm = exports;

const CACHE = new Map();

// only do 1 NPM requests at a time.
const sem = new Semaphore(1);

/**
 * Fetch package info
 * @param {String} pkg - name of the package
 * @returns {Object}
 */

npm.getInfo = async function getInfo(pkg) {
  const url = `${REGISTRY_URL}/${pkg}`;

  const cache = `/tmp/hs-packages-${pkg}.json`;
  let json;

  if (CACHE.has(pkg))
    return CACHE.get(pkg);

  if (!await fs.exists(cache)) {
    const res = await sem.do(async () => request({
      url: url,
      timeout: TIMEOUT
    }));

    json = res.json();

    CACHE.set(pkg, json);
    await fs.writeJSON(cache, json);
  } else {
    json = await fs.readJSON(cache);
  }

  return json;
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
