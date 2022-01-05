/*!
 * api/index.js - Cached version of the APIs.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const git = require('./git-low');
const npm = require('./npm-low');
const github = require('./github-low');

const {GitAPI} = require('./git');
const {GithubAPI} = require('./github');
const {NPMAPI} = require('./npm');

exports.git = git;
exports.npm = npm;
exports.github = github;

exports.GitAPI = GitAPI;
exports.GithubAPI = GithubAPI;
exports.NPMAPI = NPMAPI;
