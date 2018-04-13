"use strict";

import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.02");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("YouTube video URL parsing,", () => {
  it("https://youtu.be/BrW89n0Hss4", () => {
    const vp: VideoPlayer = tu.createPlayer(new URL("https://youtu.be/BrW89n0Hss4"), {}, undefined);
    expect(vp.getVideoId())
    .toEqual("BrW89n0Hss4");
  });

  it("https://www.youtube.com/watch?v=C0DPdy98e4c", () => {
    const vp: VideoPlayer = tu.createPlayer(new URL("https://www.youtube.com/watch?v=C0DPdy98e4c"), {}, undefined);
    expect(vp.getVideoId())
    .toEqual("C0DPdy98e4c");
  });

});

describe("YouTube playback rate validation", () => {
  let vp: VideoPlayer;

  it("Instantiate and load a new VideoPlayer", () => {
    logger.info("Instantiate a new VideoPlayer");
    vp = tu.createPlayer(new URL('https://www.youtube.com/watch?v=C0DPdy98e4c'), {}, undefined);
    return vp.loadVideo();
  });

  it("Rate is supported", () =>
    vp.setPlaybackRate(2)
    .then(() => {
      expect(vp.getPlaybackRate())
      .toBe(2);
    }),
  );

  it("Rate is UNsupported", () =>
    vp.setPlaybackRate(2.5)
    .then(() => {
      expect("setPlaybackRate(2.5) should throw an error!")
      .toEqual("But it didn't");
    })
    .catch((err: Error) => {
      expect(err.name)
      .toEqual("BadPlaybackRateException");
      expect(err.message)
      .toContain("This is not on the list of allowed playback rates");
    }),
  );

  afterAll((done) => {
    tu.destroy();
    done();
  });

});
