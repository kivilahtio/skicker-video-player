"use strict";

import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.01");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const vpElement: HTMLElement = dom.appendBodyElement("div", "youtube-video-player", "video-player");

describe("VideoPlayer URL parsing,", () => {
  let videoPlayer: VideoPlayer;

  it("Known video source; bad URL", () => {
    logger.info("Known video source; bad URL");
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
    logger.info("Unknown video source");
    const skicker: URL = new URL("https://www.skicker.com");
    expect(() => (new VideoPlayer(vpElement, {}, skicker)))
    .toThrowError(UnknownVideoSourceException, `Couldn't identify a known video source from URL '${skicker.toString()}'`);
  });

  it("Known video source and a good URL", () => {
    logger.info("Known video source and a good URL");
    const youtube: URL = new URL("https://www.youtube.com/watch?v=d1mX_MBz0HU");
    videoPlayer = new VideoPlayer(vpElement, {}, youtube);
    const apiType: SupportedVideoAPIs = (videoPlayer as any).api;

    expect(apiType)
    .toEqual(SupportedVideoAPIs.YouTube);

    expect(videoPlayer.getVideoId())
    .toEqual("d1mX_MBz0HU");
  });
});

describe("VideoPlayer, ", () => {
  let videoPlayer: VideoPlayer;

  it("Init VideoPlayer", () => {
    logger.info("Init VideoPlayer");
    videoPlayer = tu.createPlayer(new URL('https://www.youtube.com/watch?v=d1mX_MBz0HU'),
                                  {},
                                  undefined
    );
    expect(videoPlayer.getVideoId())
    .toEqual("d1mX_MBz0HU");
  });

  describe("VideoPlayer accessors, ", () => {
    it("getDuration() when video not loaded", () => {
      expect(videoPlayer.getDuration()).toBe(undefined);
    });
    it("getPosition() when video not loaded", () => {
      expect(videoPlayer.getPosition()).toBe(undefined);
    });
    it("getStatus() when video not loaded", () => {
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.notLoaded);
    });
    it("setVolume() when video not loaded", () => {
      expect(videoPlayer.getVolume()).toBe(undefined);
      expect(videoPlayer.setVolume(66)).toBe(undefined, "Then setVolume() overloads the IVideoOptions volume-directive if given when Video not laoded yet."); //setVolume has no return value
    });
    it("can do actions when video not loaded", () => {
      expect(videoPlayer.canPause()).toBe(false, "Then canPause() is false");
      expect(videoPlayer.canStart()).toBe(true, "Then canStart() is true");
      expect(videoPlayer.canStop()).toBe(false, "Then canStop() is false");
    });

    it("load video", () => {
      logger.info("load video");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.notLoaded);
      const promise = videoPlayer.loadVideo()
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.cued, "Finally Video is loaded");
      });

      //At this time YouTube player internals are in an inconsistent state and getStatus() can easily throw errors if not handled properly
      //  (this.ytPlayer.getPlayerState is not a function)
      const timeouts = {
        interval: 0,
        repetitions: 0,
      };
      timeouts.interval = window.setInterval(() => {
        if (timeouts.repetitions++ > 2) {
          window.clearInterval(timeouts.interval);
        }
        expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cueing);
        expect(videoPlayer.getDuration()).toBe(undefined);
        expect(videoPlayer.getPosition()).toBe(undefined);
        expect(videoPlayer.getVolume()).toBe(undefined);
      }, 10);

      return promise;
    });

    it("VideoPlayer injected into the given HTML element", () => {
      expect(
        $("#youtube-video-player0")
        .prop("nodeName")
      )
      .toEqual("IFRAME");
    });

    it("getDuration() when video is loaded", () => {
      expect(videoPlayer.getDuration()).toBe(3923);
    });
    it("getPosition() when video is loaded", () => {
      expect(videoPlayer.getPosition()).toBe(0);
    });
    it("getStatus() when video is loaded", () => {
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued);
    });
    it("setVolume() when video is loaded", () => {
      expect(videoPlayer.getVolume()).toBe(66, "Then setVolume() triggered before video was loaded, gets the VideoAPI volume set.");
      expect(videoPlayer.setVolume(88)).toBe(undefined, "Given setVolume() set volume normally.");
      expect(videoPlayer.getVolume()).toBe(88, "Then getVolume() returns the recently set volume.");
    });
    it("can do actions when video is loaded", () => {
      expect(videoPlayer.canPause()).toBe(false, "Then canPause() is false");
      expect(videoPlayer.canStart()).toBe(true, "Then canStart() is true");
      expect(videoPlayer.canStop()).toBe(false, "Then canStop() is false");
    });
  });

  describe("VideoPlayer pausing, ", () => {
    it("Pause when Video is cued, this causes nothing to happen", () => {
      logger.info("Pause when Video is cued");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued, "Given the video is 'cued'");
      return videoPlayer.pauseVideo()
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.cued);
      });
    });

    it("Stop when Video is cued", () => {
      logger.info("Stop when Video is cued");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued, "Given the video is 'cued'");
      return videoPlayer.stopVideo()
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.cued, "Then stopping it is ignored and video is 'cued'");
      });
    });

    it("Start when Video is cued", () => {
      logger.info("Start when Video is cued");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued, "Given the video is 'cued'");
      return tu.start();
    });
    it("can do actions when video is started", () => {
      expect(videoPlayer.canPause()).toBe(true, "Then canPause() is true");
      expect(videoPlayer.canStart()).toBe(false, "Then canStart() is false");
      expect(videoPlayer.canStop()).toBe(true, "Then canStop() is true");
    });

    it("Stop when Video is playing", () => {
      logger.info("Stop when Video is playing");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.started, "Given the video is 'started'");
      return tu.stop();
    });
    it("can do actions when video is stopped", () => {
      expect(videoPlayer.canPause()).toBe(false, "Then canPause() is false");
      expect(videoPlayer.canStart()).toBe(true, "Then canStart() is true");
      expect(videoPlayer.canStop()).toBe(false, "Then canStop() is false");
    });

    it("Pause when Video is stopped, this causes nothing to happen", () => {
      logger.info("Pause when Video is stopped");
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued, "Given the video is 'cued'");
      return videoPlayer.pauseVideo()
      .then((vapi: VideoPlayer) => {
        expect(vapi.getStatus()).toBe(VideoPlayerStatus.cued, "Finally the video is 'cued'");
      });
    });
  });

  it("Destroy", () => {
    logger.info("Destroy");
    tu.destroy();
  });
});
