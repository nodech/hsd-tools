/*!
 * fetch.js - fetch with cache.
 * Copyright (c) 2022, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const brq = require('brq');
const {Semaphore} = require('./semaphore');
const {NullCache} = require('../cache');

const fetchUtils = exports;

/**
 * Fetch the thing..
 * @param {Object} opts
 * @param {Error} opts.Error
 * @returns {Promise<Object>}
 */

fetchUtils.fetch = async function fetch(opts) {
  assert(opts.Error != null);
  let res = null;

  try {
    res = await brq({
      ...opts
    });
  } catch (e) {
    throw new opts.Error(`Failed request ${opts.method} for ${opts.url}.`
      + e.message);
  }

  if (res.statusCode === 404)
    return null;

  if (res.statusCode < 200 || res.statusCode >= 300) {
    const msg = res.json().message;
    throw new opts.Error(`Received wrong status code: ${res.statusCode},`
      + ` message: ${msg}`);
  }

  try {
    return res.json();
  } catch (e) {
    throw new opts.Error('Failed to deserialize response to JSON.');
  }
};

/**
 * Download with rate limiter.
 * @param {Semaphore} sem
 * @param {Object} opts
 * @returns {Promise<Object>}
 */

fetchUtils.fetchSem = async function fetchSem(sem, opts) {
  assert(sem instanceof Semaphore);

  return sem.do(async () => {
    return fetchUtils.fetch(opts);
  });
};

/**
 * Download/check cache
 * @param {Cache} cache
 * @param {Object} opts
 * @returns {Promise<[Object, Boolean]>} - [response, cached]
 */

fetchUtils.fetchCached = async function fetchCached(cache, opts) {
  assert(cache instanceof NullCache);
  assert(typeof opts.cacheName === 'string');
  assert(typeof opts.fileName === 'string');
  assert(typeof opts.expire === 'number' || typeof opts.expire === 'function');
  assert(opts.Error != null);

  const cached = await cache.getCache(opts.cacheName, opts.fileName);

  if (cached != null)
    return [JSON.parse(cached), true];

  let json;
  try {
    if (opts.semaphore != null) {
      json = await fetchUtils.fetchSem(opts.semaphore, opts);
    } else {
      json = await fetchUtils.fetch(opts);
    }
  } catch (e) {
    return [null, false];
  }

  if (json == null)
    return [null, false];

  let expire = 1;

  if (typeof opts.expire === 'number')
    expire = opts.expire;

  if (typeof opts.expire === 'function')
    expire = opts.expire(json);

  const raw = JSON.stringify(json, null, 2);
  await cache.cache(opts.cacheName, opts.fileName, raw, expire);

  return [json, false];
};
