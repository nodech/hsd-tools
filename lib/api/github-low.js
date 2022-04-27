/*!
 * api/github.js - Github API.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const API_URL = 'https://api.github.com';
const API = exports;

API.API_URL = API_URL;

API.USER_CONFIG = {
  username: '',
  password: ''
};

/**
 * Inject common options to the final object.
 * @param {Object} object
 * @returns {Object}
 */

API.finalize = function finalize(object) {
  return {
    ...object,
    timeout: 20000,
    headers: {
      'Accept': 'application/vnd.github.v3+json'
    }
  };
};

/**
 * Get list of Pull Requests.
 * @param {String} owner
 * @param {String} repo
 * @returns {Object} request props.
 */

API.listPRs = function listPRs(owner, repo) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/pulls`
  });
};

/**
 * Get Pull Request information
 * @param {String} owner
 * @param {String} repo
 * @param {Number} pr
 * @returns {Object} request props.
 */

API.getPR = function getPR(owner, repo, pr) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/pulls/${pr}`
  });
};

/**
 * List labels on GH Repo.
 * @param {String} owner
 * @param {String} repo
 * @param {Number} [perPage=100]
 * @param {Number} [page=1]
 * @returns {Object} request props.
 */

API.listLabels = function listLabels(owner, repo, perPage = 100, page = 1) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/labels`,
    query: {
      per_page: perPage,
      page: page
    }
  });
};

/**
 * Remove label.
 * @param {String} owner
 * @param {String} repo
 * @param {String} labelName
 * @returns {Object} request props.
 */

API.removeLabel = function removeLabel(owner, repo, labelName) {
  return API.finalize({
    method: 'DELETE',
    url: `${API_URL}/repos/${owner}/${repo}/labels/${labelName}`
  });
};

/**
 * Import label.
 * @param {String} owner
 * @param {String} repo
 * @param {Object} label
 * @param {String} label.name
 * @param {String} label.color
 * @param {String} label.description
 * @returns {Object} request props.
 */

API.importLabel = function importLabel(owner, repo, label) {
  return API.finalize({
    method: 'POST',
    url: `${API_URL}/repos/${owner}/${repo}/labels`,
    json: {
      name: label.name,
      color: label.color,
      description: label.description
    }
  });
};

/**
 * Get Tags list for a repository.
 * @param {String} owner
 * @param {String} repo
 * @returns {Object}
 */

API.getRepoTags = function getRepoTags(owner, repo) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/git/refs/tags`
  });
};

/**
 * Get master ref
 * @param {String} owner
 * @param {String} repo
 * @returns {Object}
 */

API.getMasterRef = function getMasterRef(owner, repo) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/git/refs/heads/master`
  });
};

/**
 * Get tag ref info
 * @param {String} owner
 * @param {String} repo
 * @param {String} sha
 * @returns {Object}
 */

API.getTagRefInfo = function getTagRefInfo(owner, repo, tag) {
  return API.finalize({
    method: 'GET',
    url: `${API_URL}/repos/${owner}/${repo}/git/tags/${tag}`
  });
};
