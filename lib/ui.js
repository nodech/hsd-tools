/*!
 * ui.js - terminal render.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const assert = require('assert');
const ansi = require('./utils/ansi');
const colors = require('./utils/colors');
const {STATUS} = require('./common');
const {STOPPED, RUNNING, FAILED, SKIPPED, DONE} = STATUS;

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

class Renderer {
  constructor(out) {
    this.out = out;
  }

  /**
   * @param {String} tname - Task name.
   * @param {String} sname - Step name.
   * @param {TaskStatus} status - task status
   * @returns {void}
   */

  logTask(name, status) {
    ;
  }

  /**
   * @param {String} tname - Task name.
   * @param {String} sname - Step name.
   * @param {TaskStatus} status - task status
   * @returns {void}
   */

  logStep(tname, sname, status) {
    ;
  }

  /**
   * Draw tasks
   * @param {Task[]} tasks
   * @returns {Promise}
   */

  async draw(tasks) {
    ;
  }
}

class TextRenderer extends Renderer {
  logTask(name, status) {
    if (!status)
      return;

    let color = t => t;
    let statout = '';
    switch (status) {
      case STATUS.RUNNING:
        statout = 'has started.';
        break;
      case STATUS.FAILED:
        color = colors.redText;
        statout = 'has failed';
        break;
      case STATUS.SKIPPED:
        color = colors.yellowText;
        statout = 'was skipped';
        break;
      case STATUS.DONE:
        color = colors.greenText;
        statout = 'has finished';
        break;
      default:
        return;
    }
    this.out.write(color(`Task "${name}" ${statout}.`) + '\n');
  }

  logStep(tname, sname, status) {
    if (!status)
      return;

    let color = t => t;
    let statout = '';

    switch (status) {
      case STATUS.RUNNING:
        statout = 'has started.';
        break;
      case STATUS.FAILED:
        color = colors.redText;
        statout = 'has failed';
        break;
      case STATUS.SKIPPED:
        color = colors.yellowText;
        statout = 'was skipped';
        break;
      case STATUS.DONE:
        color = colors.greenText;
        statout = 'has finished';
        break;
      default:
        return;
    }
    this.out.write(color(`Step "${tname}:${sname}" ${statout}.`) + '\n');
  }
}

class UIRenderer extends Renderer {
  constructor(out) {
    super(out);

    this.frame = 0;
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

  suffix(message) {
    if (message)
      return ` - ${message}`;

    return '';
  }

  getRunning(task) {
    if (task.status === DONE)
      return '';

    if (task.steps.size === 0)
      return '';

    return `(${task.done}/${task.steps.size})`;
  }

  getOutput(tasks, maxSteps = 8) {
    const output = [];

    const formatTask = (task) => {
      const prefix = this.prefix(task.status);
      const running = this.getRunning(task);
      const suffix = this.suffix(task.message);

      return `  ${prefix} ${running} ${task.name} ${suffix}`;
    };

    const formatStep = (step) => {
      const prefix = this.prefix(step.status);
      const suffix = this.suffix(step.message);

      return `    ${prefix} ${step.name} ${suffix}`;
    };

    const formatMore = (status, more) => {
      const prefix = this.prefix(status);

      return `    ${prefix} ...${more} more...`;
    };

    for (const task of tasks.values()) {
      output.push(formatTask(task));

      if (task.status === DONE)
        continue;

      if (task.steps.size <= maxSteps) {
        for (const step of task.steps.values())
          output.push(formatStep(step));

        continue;
      }

      const done = task.failed + task.skipped + task.done;
      const running = task.running;
      const waiting = task.stopped;

      const steps = Array.from(task.steps.values());
      const doneSteps = steps.filter(s =>
        s.status === FAILED || s.status === SKIPPED || s.status === DONE);
      const runningSteps = steps.filter(s => s.status === RUNNING);
      const waitingSteps = steps.filter(s => s.status === STOPPED);

      assert(doneSteps.length === done);
      assert(waitingSteps.length === waiting);
      assert(runningSteps.length === running);

      const {
        showDone, hiddenDone,
        showRunning, hiddenRunning,
        showWaiting, hiddenWaiting
      } = calculateSteps(done, running, waiting, maxSteps);

      if (hiddenDone) {
        const hidden = done - showDone;

        output.push(formatMore(DONE, hidden));

        for (let i = hidden + 1; i < done; i++)
          output.push(formatStep(doneSteps[i]));
      } else {
        for (const step of doneSteps)
          output.push(formatStep(step));
      }

      if (hiddenRunning) {
        const hidden = running - showRunning;
        for (let i = 0; i < showRunning - 1; i++)
          output.push(formatStep(runningSteps[i]));
        output.push(formatMore(RUNNING, hidden));
      } else {
        for (const step of runningSteps)
          output.push(formatStep(step));
      }

      if (hiddenWaiting) {
        const hidden = waiting - showWaiting;

        for (let i = 0; i < showWaiting - 1; i++)
          output.push(formatStep(waitingSteps[i]));
        output.push(formatMore(STOPPED, hidden));
      } else {
        for (const step of waitingSteps)
          output.push(formatStep(step));
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
        outs.push(ansi.erase.line + ansi.cursor.down(1));
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

    // If we erased lines in the end, move cursor back to the real end.
    if (this._output.length > output.length)
      outs.push(ansi.cursor.up(this._output.length - output.length));

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

/**
 * Calculate hidden steps
 * @param {Number} done
 * @param {Number} running
 * @param {Number} waiting
 * @param {Number} [maxSteps=8]
 */

function calculateSteps(done, running, waiting, maxSteps = 8) {
  assert(done + running + waiting >= maxSteps);
  // max
  let left = maxSteps;
  const leftForRunning = Math.min(2, done) + Math.min(2, waiting);

  const showRunning = Math.min(running, maxSteps - leftForRunning);
  const hiddenRunning = running > showRunning;
  left -= showRunning;

  const leftWaiting = Math.ceil(left / 2);
  let showWaiting = Math.min(leftWaiting, waiting);
  let hiddenWaiting = waiting > showWaiting;
  left -= showWaiting;

  const showDone = Math.min(left, done);
  const hiddenDone = done > showDone;
  left -= showDone;

  if (left && hiddenWaiting) {
    const old = showWaiting;
    showWaiting = Math.min(waiting, showWaiting + left);
    hiddenWaiting = waiting > showWaiting;
    left -= showWaiting - old;
  }

  assert(left === 0, `failed for: ${done}, ${running}, ${waiting}.`);
  assert(showDone + showRunning + showWaiting === maxSteps);

  return {
    showDone, hiddenDone,
    showRunning, hiddenRunning,
    showWaiting, hiddenWaiting
  };
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

exports.UIRenderer = UIRenderer;
exports.TextRenderer = TextRenderer;
