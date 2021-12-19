/*!
 * ui.js - terminal render.
 * Copyright (c) 2021, Nodari Chkuaselidze (MIT License).
 * https://github.com/nodech/hs-tools
 */

'use strict';

const ansi = require('./ansi');
const {STATUS} = require('./common')
const {RUNNING, DONE} = STATUS;
const {stdout} = process;

const loading = ['|', '/', '-', '\\'];

class UIRenderer {
  constructor(out) {
    this.lines = 0;
    this.counter = 0;
    this.out = out;
  }

  draw(tasks) {
    if (this.lines > 0) {
      for (let i = 0; i < this.lines; i++) {
        this.out.write(ansi.cursor.up(1)
          + ansi.erase.line
          + ansi.cursor.sol
        );
      }
    }

    stdout.write(ansi.cursor.hide);

    this.lines = 0;
    for (const task of tasks.values()) {
      let prefix = '';

      if (task.status === RUNNING)
        prefix = `${loading[this.counter % loading.length]}`;

      const done = `(${task.done}/${task.steps.size})`;

      stdout.write(`${prefix} ${task.name} ${done}\n`);
      this.lines++;

      for (const [step, sstatus] of task.steps.entries()) {
        let prefix = '';

        if (sstatus === RUNNING)
          prefix = `${loading[this.counter % loading.length]}`;

        stdout.write(`  ${prefix} ${step} - ${sstatus}\n`);
        this.lines++;
      }
    }
    this.counter++;

    stdout.write(ansi.cursor.show);
  }
}

exports.UIRenderer = UIRenderer;
