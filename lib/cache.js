/*!
 * cache.js - Cache manager.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('bfile');
const common = require('./common');

const T_MINUTE = 60;
const T_HOUR = T_MINUTE * 60;

class NullCache {
  init() {
    ;
  }

  async ensure() {
    ;
  }

  async open() {
  }

  async close() {
  }

  async cache(name, file, data, timeout) {
    return true;
  }

  async getCache(name, file) {
    return null;
  }
}

class Cache {
  constructor(options) {
    this.cwd = '/';
    this.cacheDir = '';
    this.cacheInfoFile = '';

    this.ignore = false;

    this.hasChanged = false;
    this.cacheMap = new Map();
    this.version = 0;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(typeof options === 'object');
    assert(typeof options.cwd === 'string');

    this.cwd = options.cwd;

    if (options.ignore != null) {
      assert(typeof options.ignore === 'boolean');
      this.ignore = options.ignore;
    }

    return this;
  }

  init() {
    this.cacheDir = path.join(this.cwd, common.CACHE_DIR);
    this.cacheInfoFile = path.join(this.cacheDir, common.CACHE_FILE);
  }

  async ensure() {
    if (!await fs.exists(this.cacheDir))
      await fs.mkdir(this.cacheDir);
  }

  async open() {
    await this.readCacheInfo();
  }

  async close() {
    await this.writeCacheInfo();
  }

  async readCacheInfo() {
    if (!await fs.exists(this.cacheInfoFile))
      return false;

    const json = await fs.readJSON(this.cacheInfoFile);
    const version = json.version;

    if (version !== this.version)
      return false;

    for (const [k, v] of json.entries)
      this.cacheMap.set(k, CacheEntry.fromJSON(v));

    return true;
  }

  async writeCacheInfo() {
    if (!this.hasChanged)
      return false;

    const entries = Array.from(this.cacheMap.entries());
    const json = {
      version: this.version,
      entries: entries
    };

    await fs.writeJSON(this.cacheInfoFile, json, {
      space: 2
    });

    this.hasChanged = false;

    return true;
  }

  /**
   * Save the cache.
   * @param {String} name
   * @param {String} file
   * @param {String|Buffer} data
   * @param {Number} [timeout=7200] - default 2 hours
   * @returns {Promise}
   */

  async cache(name, file, data, timeout = 2 * T_HOUR) {
    if (this.ignore)
      return false;

    const currentTime = now();
    const entry = new CacheEntry({
      name: name,
      file: file,
      createdAt: currentTime,
      timeoutAt: currentTime + timeout
    });
    const dirname = path.join(this.cacheDir, entry.dirname);
    const dest = path.join(this.cacheDir, entry.path);

    if (!await fs.exists(dirname))
      await fs.mkdirp(dirname);

    this.cacheMap.set(entry.id, entry);
    this.hasChanged = true;

    await fs.writeFile(dest, data);
    return true;
  }

  /**
   * Get the cache.
   * @param {String} name
   * @param {String} file
   * @returns {Buffer|null}
   */

  async getCache(name, file) {
    if (this.ignore)
      return null;

    const tentry = new CacheEntry({ name, file });

    if (!this.cacheMap.has(tentry.id))
      return null;

    const entry = this.cacheMap.get(tentry.id);
    const fileLoc = path.join(this.cacheDir, entry.path);
    const exists = await fs.exists(fileLoc);

    if (!exists) {
      this.hasChanged = true;
      this.cacheMap.delete(entry.id);
      return null;
    }

    if (exists && entry.hasExpired) {
      this.hasChanged = true;
      this.cacheMap.delete(entry.id);
      await fs.unlink(fileLoc);
      return null;
    }

    return fs.readFile(fileLoc);
  }
}

class CacheEntry {
  constructor(options = {}) {
    this.createdAt = options.createdAt;
    this.timeoutAt = options.timeoutAt;
    this.name = options.name;
    this.file = options.file;
  }

  get dirname() {
    return path.dirname(this.path);
  }

  get path() {
    return `${this.name}/${this.file}`;
  }

  get id() {
    return this.path;
  }

  get hasExpired() {
    if (this.timeoutAt === this.createdAt)
      return false;

    // add some random noise here. (Don't expire everything at once?)
    const diff = this.timeoutAt - this.createdAt;
    const rand = Math.floor(diff * Math.random());

    return this.timeoutAt + rand <= now();
  }

  toJSON() {
    return {
      name: this.name,
      file: this.file,
      createdAt: this.createdAt,
      timeoutAt: this.timeoutAt
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.file === 'string');
    assert(typeof json.createdAt === 'number');
    assert(typeof json.timeoutAt === 'number');

    this.name = json.name;
    this.file = json.file;
    this.timeoutAt = json.timeoutAt;
    this.createdAt = json.createdAt;

    return this;
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }
}

function now() {
  return Math.floor(Date.now() / 1000);
}

exports.Cache = Cache;
exports.NullCache = NullCache;
exports.CacheEntry = CacheEntry;

// Export some timings
exports.T_MINUTE = T_MINUTE;
exports.T_HOUR = T_HOUR;
