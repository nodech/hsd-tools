/*!
 * ui.js - terminal render.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const ansi = require('./ansi');
const colors = require('./colors');
const {STATUS} = require('./common')
const {RUNNING, DONE} = STATUS;

// const TICK = '✔';
// const CROSS = '✖';
const LOZENGE = '◆';
const LOZENGE_OUTLINE = '◇';

// const loading = ['|', '/', '-', '\\'];
const loading = [
  '⠋',
  '⠙',
  '⠹',
  '⠸',
  '⠼',
  '⠴',
  '⠦',
  '⠧',
  '⠇',
  '⠏'
];

class UIRenderer {
  constructor(out) {
    this.frame = 0;
    this.out = out;
    this._output = null;
  }

  loading() {
    return `${loading[this.frame % loading.length]}`;
  }

  prefix(status) {
    if (status === RUNNING)
      return colors.yellowText(this.loading());

    if (status === DONE)
      return colors.greenText(LOZENGE);

    return LOZENGE_OUTLINE;
  }

  getDone(task) {
    if (task.status === DONE)
      return '';

    if (task.steps.size === 0)
      return '';

    return `(${task.done}/${task.steps.size})`;
  }

  getOutput(tasks) {
    const output = [];
    for (const task of tasks.values()) {
      const prefix = this.prefix(task.status);
      const done = this.getDone(task);

      output.push(`  ${prefix} ${done} ${task.name}`);

      if (task.status === DONE)
        continue;

      for (const [step, sstatus] of task.steps.entries()) {
        const prefix = this.prefix(sstatus);

        output.push(`    ${prefix} ${step} - ${sstatus}`);
      }
    }

    return output;
  }

  async draw(tasks) {
    const output = this.getOutput(tasks);

    if (this._output == null) {
      // this.clearLines();
      this._output = output;
      // this.lines = output.length;

      this.out.write(output.join('\n') + '\n');

      this.frame++;
      return;
    }

    // only 1 for now, need to handle ansi things.
    const diffChars = 1;
    let cursor = 0;

    const outs = [];
    // we don't use .length - 1 because we have extra space
    outs.push(ansi.cursor.up(this._output.length));

    for (let i = 0; i < this._output.length; i++) {
      if (i >= output.length) {
        outs.push(ansi.erase.line);
        cursor++;
        continue;
      }

      const diff = getDiff(this._output[i], output[i], diffChars);

      if (diff === null) {
        outs.push(ansi.cursor.sol + ansi.erase.eol);
        outs.push(output[i]);
        outs.push(ansi.cursor.down(1) + ansi.cursor.sol);
        cursor++;
        continue;
      }

      if (diff.size === 0) {
        outs.push(ansi.cursor.down(1));
        cursor++;
        continue;
      }

      // something went wrong (currently 1 only)
      assert(diff.size <= diffChars,
        'Something went wrong with diff.' + diff.size);

      for (const [at, value] of diff.entries()) {
        outs.push(ansi.cursor.sol + ansi.cursor.right(at));
        outs.push(value);
      }

      outs.push(ansi.cursor.down(1) + ansi.cursor.sol);
      cursor++;
    }

    assert(cursor === this._output.length,
      `cursor: ${cursor} != prevout len: ${this._output.length}`);

    if (this._output.length < output.length) {
      // print extra lines
      const extra = output.slice(this._output.length);
      outs.push(extra.join('\n') + '\n');
    }

    this._output = output;
    this.out.write(outs.join(''));
    this.frame++;
  }

  clearLines() {
    if (this._output == null)
      return;

    const clears = [];
    for (let i = 0; i < this._output.length; i++) {
      clears.push(ansi.cursor.up(1)
        + ansi.erase.line
        + ansi.cursor.sol
      );
    }

    this.out.write(clears.join(''));
  }
}

/**
 * Currently only supports 1 char diff.
 * @param {String} stra
 * @param {String} strb
 * @param {Number} maxDiffs
 * @returns {Map<Number, String>|null} - null there are too many diffs issues.
 */

function getDiff(stra, strb, maxDiffs) {
  if (stra.length !== strb.length)
    return null;

  const diff = new Map();
  let diffCount = 0;

  stra = stripAnsi(stra);
  // strb = stripAnsi(strb);
  for (let i = 0; i < stra.length; i++) {
    if (stra[i] !== strb[i]) {
      // console.log('---', stra, '\n---', strb, i);
      diff.set(i, strb[i]);
      diffCount++;
    }

    if (diffCount > maxDiffs)
      return null;
  }

  return diff;
}

// from: https://github.com/chalk/ansi-regex/
// eslint-ignore-next-function
function ansiRegex() {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|'
    + '[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
  ].join('|');

  return new RegExp(pattern, 'g');
}

function stripAnsi(string) {
  return string.replace(ansiRegex(), '');
}

async function sleep() {
  return new Promise(r => setTimeout(r, 50));
}

exports.UIRenderer = UIRenderer;
