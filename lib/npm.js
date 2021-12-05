/*!
 * npm.js - npm utilities
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const assert = require('assert');
const request = require('brq');
const fs = require('bfile');

const REGISTRY_URL = 'https://registry.npmjs.org/';

const npm = exports;

const CACHE = new Map();

/**
 * Fetch package info
 * @param {String} pkg - name of the package
 * @returns {Object}
 */

npm.getInfo = async function getInfo(pkg) {
  const url = `${REGISTRY_URL}/${pkg}`;

  const cache = `/tmp/${pkg}.json`;
  let json;

  if (CACHE.has(pkg))
    return CACHE.get(pkg);

  if (!await fs.exists(cache)) {
    const res = await request(url);
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
