/*!
 * package.js - package information
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const assert = require('assert');
const git = require('./git');

const DEPENDENCY_TYPE = {
  NONE: 0,
  GIT: 1,
  NPM: 2
};

const dependencyTypeByVal = [
  'NONE',
  'GIT',
  'NPM'
];

class PackagesInfo {
  constructor() {
    this.modified = false;

    this.version = 0;
    this.packages = new Map();
  }

  hasPackage(name) {
    return this.packages.has(name);
  }

  /**
   * Add package to the packages
   * @param {Object} packageDetails
   * @returns {PackagesInfo}
   */

  addPackage(options) {
    // assert(!this.hasPackage(options.name), 'Package already exists.');

    this.modified = true;
    this.packages.set(options.name, new PackageDetails(options));
  }

  /**
   * Return package info
   * @param {String} name
   * @returns {PackageDetails}
   */

  getPackage(name) {
    return this.packages.get(name);
  }

  toJSON() {
    return {
      version: this.version,
      packages: map2json(this.packages)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.version === 'number');

    this.version = json.version;
    this.packages = json2map(json.packages, PackageDetails);

    return this;
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }
}

class PackageDetails {
  constructor(options) {
    this.name = null;
    this.dirname = null;

    this.gitRemotes = new Map();

    this.npmName = null;
    this.npmVersions = {};
    this.npmAliases = {};

    this.dependencies = {};

    this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'options are required.');
    assert(typeof options === 'object', 'options must be an object.');
    assert(typeof options.name === 'string',
      'options.name must be a string');

    this.name = options.name;
    this.dirname = options.name;
    this.npmName = options.name;

    if (options.dirname != null) {
      assert(typeof options.dirname === 'string',
        'options.dirname must be a string.');
      this.dirname = options.dirname;
    }

    if (options.npmName != null) {
      assert(typeof options.npmName === 'string',
        'options.npmName must be a string.');

      this.npmName = options.npmName;
    }

    if (options.gitURL != null) {
      assert(typeof options.gitURL === 'object',
        'options.gitURL must be an object.');
      this.addRemote(options.gitURL);
    }

    return this;
  }

  /**
   * @param {GitUrl} url
   * @returns {PackageDetails}
   */

  addRemote(url) {
    const name = `${url.server}/${url.owner}`;
    this.gitRemotes.set(name, new PackageGitRemote({ name, url }));

    return this;
  }

  /**
   * @param {String} remoteName
   * @returns {PackageGitRemote}
   */

  getRemote(remoteName) {
    return this.gitRemotes.get(remoteName);
  }

  toJSON() {
    return {
      name: this.name,
      dirname: this.dirname,
      npmName: this.npmName,
      gitRemotes: map2json(this.gitRemotes)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.dirname === 'string');
    assert(typeof json.npmName === 'string');
    assert(typeof json.gitRemotes === 'object');

    this.name = json.name;
    this.dirname = json.dirname;
    this.npmName = json.npmName;
    this.gitRemotes = json2map(json.gitRemotes, PackageGitRemote);
  }

  static fromJSON(json) {
    return new this({
      name: json.name
    }).fromJSON(json);
  }
}

class PackageDependency {
  constructor(options) {
    this.name = null;
    this.type = DEPENDENCY_TYPE.NONE;
    this.version = null;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options);

    if (options.name != null) {
      assert(typeof options.name === 'string');
      this.name = options.name;
    }

    if (options.type != null) {
      assert(typeof options.type === 'number');
      this.type = options.type;
    }

    if (options.version != null) {
      assert(typeof options.version === 'string');
      this.version = options.type;
    }

    return this;
  }

  isNPM() {
    return this.type === DEPENDENCY_TYPE.NPM;
  }

  isGIT() {
    return this.type === DEPENDENCY_TYPE.GIT;
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      typeName: dependencyTypeByVal[this.type],
      version: this.version
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.type === 'number');
    assert(typeof json.version === 'string');

    this.name = json.name;
    this.type = json.type;
    this.version = json.version;
  }
}

class PackageGitRemote {
  constructor(options) {
    this.name = null;
    this.url = new git.GitUrl();
    this.master = null;
    this.versions = new Map();
    this.aliases = new Map();

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options);

    if (options.name != null) {
      assert(typeof options.name === 'string');
      this.name = options.name;
    }

    if (options.url != null) {
      assert(typeof options.url === 'object');
      this.url = options.url;
    }
  }

  getFetchURL() {
    return this.url.toHTTPGit();
  }

  updateLSRemote(info) {
    this.master = info.master;

    for (const [key, value] of Object.entries(info.tags)) {
      if (git.isVersion(key)) {
        const version = key.replace('v', '');
        this.versions.set(version, value);
        continue;
      }

      this.aliases.set(key, value);
    }
  }

  toJSON() {
    return {
      name: this.name,
      url: this.url.toHTTPGit(),
      master: this.master,
      versions: map2json(this.versions),
      aliases: map2json(this.aliases)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.url === 'string');
    assert(typeof json.master === 'string');
    assert(typeof json.versions === 'object');
    assert(typeof json.aliases === 'object');

    this.name = json.name;
    this.url = git.GitUrl.fromURL(json.url);
    this.versions = json2map(json.versions);
    this.aliases = json2map(json.aliases);
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }
}

function map2json(map) {
  const obj = {};

  for (const [key, value] of map.entries())
    obj[key] = value.toJSON ? value.toJSON() : value;

  return obj;
}

function json2map(json, reviver) {
  const map = new Map();

  if (reviver) {
    for (const [key, value] of Object.entries(json))
      map.set(key, reviver.fromJSON(value));

    return map;
  }

  for (const [key, value] of Object.entries(json))
    map.set(key, value);

  return map;
}

exports.PackageDetails = PackageDetails;
exports.PackagesInfo = PackagesInfo;
exports.PackageGitRemote = PackageGitRemote;
exports.PackageDependency = PackageDependency;
