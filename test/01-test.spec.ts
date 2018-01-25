"use strict";

import {LoggerManager} from "skicker-logger-manager";

const lm: LoggerManager = new LoggerManager(true);

describe("A suite is just a function", () => {
  let a: any;

  it("and so is a spec", () => {
    a = true;

    expect(a).toBe(true);
  });

  it("and so is a specarrrr", () => {
    a = true;

    expect(a).toBe(true);
  });
});
