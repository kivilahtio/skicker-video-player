import * as $ from "jquery";

import { BadPlaybackRateException } from "../src/Exception/BadPlaybackRate";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoPlayerStatus, VideoAPI } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.03");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Seek a video", () => {
  let videoPlayer: VideoPlayer;

  it("Instantiate a new VideoPlayer", () => {
    logger.info("Instantiate a new VideoPlayer");
    videoPlayer = tu.createPlayer(new URL('https://www.youtube.com/watch?v=C0DPdy98e4c'),
                                  {},
                                  undefined
    );
  });

  it("Load-action triggered", () => {
    logger.info("Load-action triggered");
    return videoPlayer
    .loadVideo()
    .then(() => {
      expect(videoPlayer.getStatus())
      .toBe(VideoPlayerStatus.videoCued);
    });
  });

  describe("Seek when VideoPlayer is freshly loaded,", () => {
    it("Seek-action triggered", () => {
      logger.info("Seek-action triggered");
      return videoPlayer
      .seekVideo(10.500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(10.500);
        expect(pos).toBeLessThanOrEqual(11.000);
      });
    });
    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () => {
      logger.info("Seek-action triggered again to test onStateChangeHandlers for same-state transition");
      return videoPlayer
      .seekVideo(11.500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(11.500);
        expect(pos).toBeLessThanOrEqual(12.000);
      });
    });
  });

  describe("Start playing and seek,", () => {
    it("Start-action triggered", () => {
      logger.info("Start-action triggered");
      return videoPlayer.startVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");
      });
    });

    it("Seek-action triggered", () => {
      logger.info("Seek-action triggered");
      return videoPlayer
      .seekVideo(13.2500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(13.250);
        expect(pos).toBeLessThanOrEqual(13.750);
      });
    });

    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () => {
      logger.info("Seek-action triggered again to test onStateChangeHandlers for same-state transition");
      return videoPlayer
      .seekVideo(14.2500)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("playing");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(14.250);
        expect(pos).toBeLessThanOrEqual(14.750);
      });
    });
  });

  describe("Stop the video and seek,", () => {
    it("Stop-action triggered", () => {
      logger.info("Stop-action triggered");
      return videoPlayer
      .stopVideo()
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("unstarted");
      });
    });

    it("Seek-action triggered", () => {
      logger.info("Seek-action triggered");
      return videoPlayer
      .seekVideo(1.666)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(1.666);
        expect(pos).toBeLessThanOrEqual(2.166);
      });
    });

    it("Seek-action triggered again to test onStateChangeHandlers for same-state transition", () => {
      logger.info("Seek-action triggered again to test onStateChangeHandlers for same-state transition");
      return videoPlayer
      .seekVideo(2.555)
      .then(() => {
        expect(videoPlayer.getStatus())
        .toBe("paused");

        const pos: number = videoPlayer.getVideoAPI().getPosition();
        expect(pos).toBeGreaterThanOrEqual(2.555);
        expect(pos).toBeLessThanOrEqual(2.655);
      });
    });
  });

  it("Destroy the video player,", () => {
    logger.info("Destroy the video player");
    tu.destroy();
  });
});
