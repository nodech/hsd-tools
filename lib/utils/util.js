/*!
 * util.js - other utils.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const nodeUtil = require('util');
const readline = require('readline');
const fs = require('bfile');
const Config = require('bcfg');
const git = require('../api/git');
const npm = require('../api/npm');
const semver = require('../../vendor/semver');
const ansi = require('./ansi');

const util = exports;

util.getConfigs = (options, configs) => {
  const cfg = new Config('hs-tools', configs);

  if (options) {
    cfg.inject(options);
    cfg.load(options);
  }

  if (options && options.file && fs.existsSync(options.file)) {
    const json = JSON.parse(fs.readFileSync(options.file).toString());
    cfg.inject(json);
  }

  return cfg;
};

/**
 * Ask question to the terminal
 * @param {String} question - question to show.
 * @returns {String} return answer.
 */

util.question = async (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const rlQuestion = nodeUtil.promisify(rl.question).bind(rl);
  const answer = await rlQuestion(question);

  rl.close();
  return answer;
};

/**
 * Get package name.
 * @param {String} str - url or pkg name
 * @returns {String}
 */

util.getPackageName = function getPackageName(str) {
  if (npm.isNpmPackage(str))
    return str;

  if (git.isGitUrl(str))
    return git.getPKGName(str);

  return null;
};

/**
 * Sort semver versions
 * @param {String[]} versions
 * @returns {String[]} - sorted versions
 */

util.sortSemver = (versions) => {
  const sorted = versions.slice();
  sorted.sort(semver.compare);
  return sorted;
};

/**
 * Escape string for the shell.
 * @param {String} str
 * @returns {String}
 */

util.shellEscape = function shellEscape(str) {
  // TODO?
  return str;
};

/**
 * Print tables
 * @param {String[]} headers
 * @param {Object[]} entries
 * @param {Object} options
 * @returns {String}
 */

util.printTable = function printTable(headers, entries, options = {}) {
  const maxLengths = {};
  const padNum = options.pad != null ? options.pad : 2;
  const pad = ' '.repeat(padNum);

  const printEntry = (entry) => {
    let out = pad;

    for (const header of headers) {
      const str = entry[header] || '';
      out += str;
      out += ' '.repeat(maxLengths[header] - ansi.stripAnsi(str).length);
      out += pad;
    }

    return out;
  };

  for (const header of headers) {
    maxLengths[header] = header.length;

    for (const entry of entries) {
      if (!entry[header])
        continue;

      const len = ansi.stripAnsi(entry[header]).length;

      if (len > maxLengths[header])
        maxLengths[header] = len;
    }
  }

  const out = [];

  out.push(printEntry(Object.fromEntries(headers.map(h => [h, h]))));

  for (const entry of entries)
    out.push(printEntry(entry));

  return out.join('\n');
};
