"use strict";

import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");

describe("VideoPlayer URL parsing,", () => {
  let videoPlayer: VideoPlayer;

  it("Known video source; bad URL", () => {
    let youtube: URL = new URL("https://www.youtube.com");
    expect(() => (new VideoPlayer(vpElement, {}, youtube)))
    .toThrowError(
      BadParameterException,
      `URL '${youtube.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);

    youtube = new URL("https://www.youtube.com/video/id/vASDasd33");
    expect(() => (new VideoPlayer(vpElement, {}, youtube)))
    .toThrowError(
      BadParameterException,
      `URL '${youtube.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);
  });

  it("Unknown video source", () => {
    const skicker: URL = new URL("https://www.skicker.com");
    expect(() => (new VideoPlayer(vpElement, {}, skicker)))
    .toThrowError(UnknownVideoSourceException, `Couldn't identify a known video source from URL '${skicker.toString()}'`);
  });

  it("Known video source and a good URL", () => {
    const youtube: URL = new URL("https://www.youtube.com/watch?v=d1mX_MBz0HU");
    videoPlayer = new VideoPlayer(vpElement, {}, youtube);
    const apiType: SupportedVideoAPIs = (videoPlayer as any).api;

    expect(apiType)
    .toEqual(SupportedVideoAPIs.YouTube);

    expect(videoPlayer.getVideoId())
    .toEqual("d1mX_MBz0HU");
  });
});

describe("VideoPlayer accessors", () => {
  let videoPlayer: VideoPlayer;

  it("Init VideoPlayer", () => {
    videoPlayer = new VideoPlayer(vpElement, {}, new URL("https://www.youtube.com/watch?v=d1mX_MBz0HU"));
    expect(videoPlayer.getVideoId())
    .toEqual("d1mX_MBz0HU");
  });

  it("getDuration() when video not loaded", () => {
    expect(videoPlayer.getDuration()).toBe(-1);
  });
  it("getPosition() when video not loaded", () => {
    expect(videoPlayer.getPosition()).toBe(-1);
  });
  it("getStatus() when video not loaded", () => {
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.notLoaded);
  });

  it("load video", () =>
    videoPlayer.loadVideo()
    .then((vapi: VideoAPI) => {
      expect(vapi).toBeTruthy(); //Just any test to stop Jasmine from complaining about an empty test
    }),
  );

  it("getDuration() when video is loaded", () => {
    expect(videoPlayer.getDuration()).toBe(3923);
  });
  it("getPosition() when video is loaded", () => {
    expect(videoPlayer.getPosition()).toBe(0);
  });
  it("getStatus() when video is loaded", () => {
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.videoCued);
  });

  describe("Destroy the video player,", () => {
    it("Destroy-action triggered", () => {
      videoPlayer
      .destroy();
      expect($(vpElement)
             .find("*").length)
      .toBe(0);
    });
  });
});
