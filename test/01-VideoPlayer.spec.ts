"use strict";

import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("VideoPlayer URL parsing,", () => {
  const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");
  const videoPlayer: VideoPlayer = new VideoPlayer(vpElement);

  it("Known video source; bad URL", () => {
    let youtube: URL = new URL("https://www.youtube.com");
    expect(() => (videoPlayer as any).parseURL(youtube))
    .toThrowError(
      BadParameterException,
      `URL '${youtube.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);

    youtube = new URL("https://www.youtube.com/video/id/vASDasd33");
    expect(() => (videoPlayer as any).parseURL(youtube))
    .toThrowError(
      BadParameterException,
      `URL '${youtube.toString()}' doesn't include the video id. Using video source '${SupportedVideoAPIs.YouTube}'. Expected the URL to look like 'https://www.youtube.com/watch?v=d1mX_MBz0HU'`);
  });

  it("Unknown video source", () => {
    const skicker: URL = new URL("https://www.skicker.com");
    expect(() => (videoPlayer as any).parseURL(skicker))
    .toThrowError(UnknownVideoSourceException, `Couldn't identify a known video source from URL '${skicker.toString()}'`);
  });

  it("Known video source and a good URL", () => {
    const youtube: URL = new URL("https://www.youtube.com/watch?v=d1mX_MBz0HU");
    const apiType: SupportedVideoAPIs = (videoPlayer as any).parseURL(youtube);

    expect(apiType)
    .toEqual(SupportedVideoAPIs.YouTube);

    expect(videoPlayer.getVideoId())
    .toEqual("d1mX_MBz0HU");
  });
});
