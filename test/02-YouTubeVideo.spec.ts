"use strict";

import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");

describe("YouTube video URL parsing,", () => {
  it("https://youtu.be/BrW89n0Hss4", () => {
    const vp = new VideoPlayer(vpElement, {}, new URL("https://youtu.be/BrW89n0Hss4"));
    expect(vp)
    .toBeTruthy();
    expect(vp.getVideoId())
    .toEqual("BrW89n0Hss4");
  });

  it("https://www.youtube.com/watch?v=C0DPdy98e4c", () => {
    const vp = new VideoPlayer(vpElement, {}, new URL("https://www.youtube.com/watch?v=C0DPdy98e4c"));
    expect(vp)
    .toBeTruthy();
    expect(vp.getVideoId())
    .toEqual("C0DPdy98e4c");
  });

});

describe("VideoPlayer rate validation", () => {
  const ytVideo: YouTubeVideo = new YouTubeVideo(vpElement);

  beforeAll((done) => {
    ytVideo.loadVideo("M7lc1UVf-VE")
    .then(done)
    .catch((err: any) => {
      fail(`Loading a YouTube video failed because of\n${err.toString()}`);
    });
  });

  it("Rate is supported", () =>
    ytVideo.setPlaybackRate(2)
    .then(() => {
      expect(ytVideo.getPlaybackRate())
      .toBe(2);
    }),
  );

  it("Rate is UNsupported", () =>
    ytVideo.setPlaybackRate(2.5)
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
    ytVideo.destroy();
    done();
  });

});