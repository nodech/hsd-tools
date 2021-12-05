/*!
 * package.js - package information
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-packages
 */

'use strict';

const assert = require('assert');
const semver = require('../vendor/semver');
const git = require('./git');
const util = require('./util');

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
   * Add package to the packages.
   * @param {Object} packageDetails
   * @returns {PackagesInfo}
   */

  addPackage(options) {
    assert(!this.hasPackage(options.name), 'Package already exists.');

    this.modified = true;
    this.packages.set(options.name, new PackageDetails(this, options));
  }

  /**
   * Remove package from the packages.
   * @param {String} name
   * @returns {PackagesInfo}
   */

  removePackage(name) {
    assert(this.hasPackage(name), 'Package does not exist.');

    this.modified = true;
    this.packages.delete(name);
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
    this.packages = json2map(json.packages, PackageDetails, this);

    return this;
  }

  static fromJSON(json) {
    return new this().fromJSON(json);
  }
}

/**
 * This only manages 1 git remote + 1 npm
 * for simplicity reasons.
 */

class PackageDetails {
  constructor(packages, options) {
    this.packages = packages;
    this.name = null;
    this.dirname = null;

    this.gitInfo = new PackageGIT(this);
    this.npmInfo = new PackageNPM(this);

    this.dependencies = new Map();
    this.devDependencies = new Map();

    this.fromOptions(options);
  }

  set modified(value) {
    this.packages.modified = value;
  }

  fromOptions(options) {
    assert(options, 'options are required.');
    assert(typeof options === 'object', 'options must be an object.');
    assert(typeof options.name === 'string',
      'options.name must be a string');

    this.name = options.name;
    this.dirname = options.name;

    if (options.dirname != null) {
      assert(typeof options.dirname === 'string',
        'options.dirname must be a string.');
      this.dirname = options.dirname;
    }

    if (options.gitURL != null) {
      assert(typeof options.gitURL === 'object',
        'options.gitURL must be an object.');
      this.gitInfo.url = options.gitURL;
    }

    if (options.dependencies != null) {
      assert(typeof options.dependencies === 'object',
        'options.dependencies must ba an object.');
      this.setDependencies(options.dependencies);
    }

    if (options.devDependencies != null) {
      assert(typeof options.devDependencies === 'object',
        'options.devDependencies must ba an object.');
      this.setDevDependencies(options.devDependencies);
    }

    if (options.npmInfo != null) {
      assert(typeof options.npmInfo === 'object',
        'options.npmInfo must be an object.');
      this.npmInfo.data = options.npmInfo;
    }

    this.npmInfo.name = this.name;

    return this;
  }

  /**
   * Set dependencies of the package.
   * @param {Object} dependencies
   * @returns {PackageDetails}
   */

  setDependencies(dependencies) {
    this.modified = true;
    for (const [dep, version] of Object.entries(dependencies)) {
      const pkgdep = new PackageDependency({
        name: dep,
        version: version
      });

      this.dependencies.set(dep, pkgdep);
    }
  }

  /**
   * Set dev dependencies of the package.
   * @param {Object} dependencies
   * @returns {PackageDetails}
   */

  setDevDependencies(dependencies) {
    this.modified = true;
    for (const [dep, version] of Object.entries(dependencies)) {
      const pkgdep = new PackageDependency({
        name: dep,
        version: version
      });

      this.devDependencies.set(dep, pkgdep);
    }
  }

  toJSON() {
    return {
      name: this.name,
      dirname: this.dirname,
      gitInfo: this.gitInfo.toJSON(),
      npmInfo: this.npmInfo.toJSON(),
      dependencies: map2json(this.dependencies),
      devDependencies: map2json(this.devDependencies)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.dirname === 'string');
    assert(typeof json.gitInfo === 'object');
    assert(typeof json.dependencies === 'object');
    assert(typeof json.devDependencies === 'object');

    this.name = json.name;
    this.dirname = json.dirname;
    this.gitInfo = PackageGIT.fromJSON(json.gitInfo, this);
    this.npmInfo = PackageNPM.fromJSON(json.npmInfo, this);
    this.dependencies = json2map(
      json.dependencies,
      PackageDependency,
      this
    );

    this.devDependencies = json2map(
      json.devDependencies,
      PackageDependency,
      this
    );

    return this;
  }

  static fromJSON(json, packages) {
    return new this(packages, {
      name: json.name
    }).fromJSON(json);
  }
}

class PackageGIT {
  constructor(details, options) {
    this.details = details;
    this.url = new git.GitUrl();
    this.master = null;
    this.versions = new Map();
    this.aliases = new Map();

    this._latest = null;

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options);

    if (options.url != null) {
      assert(typeof options.url === 'object');
      this.url = options.url;
    }
  }

  set modified(value) {
    this.details.modified = value;
  }

  get latest() {
    if (this._latest)
      return this._latest;

    if (this.aliases.has('latest')) {
      const latest = this.aliases.get('latest');
      this._latest = latest;
      return this._latest;
    }

    const versions = Array.from(this.versions.keys());
    versions.reverse();
    const sorted = util.sortSemver(versions);
    this._latest = sorted.pop();

    return this._latest;
  }

  getFetchURL() {
    return this.url.toHTTPGit();
  }

  updateLSRemote(info) {
    this.modified = true;
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
      url: this.url.toHTTPGit(),
      master: this.master,
      latest: this.latest,
      versions: map2json(this.versions),
      aliases: map2json(this.aliases)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.url === 'string');
    assert(typeof json.master === 'string');
    assert(typeof json.versions === 'object');
    assert(typeof json.aliases === 'object');

    this.url = git.GitUrl.fromURL(json.url);
    this.versions = json2map(json.versions);
    this.aliases = json2map(json.aliases);

    return this;
  }

  static fromJSON(json, details) {
    return new this(details).fromJSON(json);
  }
}

class PackageNPM {
  constructor(details, name) {
    this.details = details;
    this.name = name;
    this.homepage = '';
    this.tags = new Map();
    this.versions = new Map();
  }

  set modified(value) {
    this.details.modified = value;
  }

  get gitRepository() {
    return git.gitURL.fromURL(this.homepage);
  }

  get npmURL() {
    return `https://www.npmjs.com/package/${this.name}`;
  }

  get latest() {
    return this.tags.get('latest');
  }

  /**
   * Only collect necessary data from npm.
   * @param {Object} info - npm json response.
   */

  setInfo(info) {
    this.modified = true;

    this.homepage = info.homepage;

    for (const version of Object.keys(info.versions)) {
      const time = info.time[version];
      this.versions.set(version, time);
    }

    for (const [tag, version] of Object.entries(info['dist-tags']))
      this.tags.set(tag, version);
  }

  toJSON() {
    return {
      name: this.name,
      homepage: this.homepage,
      url: this.npmURL,
      tags: map2json(this.tags),
      versions: map2json(this.versions)
    };
  }

  fromJSON(json) {
    assert(typeof json === 'object');
    assert(typeof json.name === 'string');
    assert(typeof json.homepage === 'string');
    assert(typeof json.tags === 'object');
    assert(typeof json.versions === 'object');

    this.name = json.name;
    this.homepage = json.homepage;
    this.tags = json2map(json.tags);
    this.versions = json2map(json.versions);

    return this;
  }

  static fromJSON(json, details) {
    return new this(details).fromJSON(json);
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

    if (options.version != null) {
      assert(typeof options.version === 'string');
      const [type, version] = this.parseVersion(options.version);
      this.type = type;
      this.version = version;
    }

    return this;
  }

  parseVersion(versionStr) {
    let type, version;

    if (versionStr.startsWith('git+https://')
      || versionStr.startsWith('https://')) {
      const url = git.GitUrl.fromURL(version);

      type = DEPENDENCY_TYPE.GIT;
      version = url.toDependencyURL();
    } else if (semver.validRange(versionStr)) {
      type = DEPENDENCY_TYPE.NPM;
      version = versionStr;
    } else {
      type = DEPENDENCY_TYPE.NONE;
      version = versionStr;
    }

    return [type, version];
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

    return this;
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

function json2map(json, reviver, extra) {
  const map = new Map();

  if (reviver) {
    for (const [key, value] of Object.entries(json))
      map.set(key, reviver.fromJSON(value, extra));

    return map;
  }

  for (const [key, value] of Object.entries(json))
    map.set(key, value);

  return map;
}

exports.PackageDetails = PackageDetails;
exports.PackagesInfo = PackagesInfo;
exports.PackageGIT = PackageGIT;
exports.PackageNPM = PackageNPM;
exports.PackageDependency = PackageDependency;
