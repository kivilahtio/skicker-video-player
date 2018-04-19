import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.01");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

const localVideo: string = require("../test/helpers/aarnilasku.mp4");

/**
 * Test suite is ran with different VideoAPI implementations
 * Implementations must behave the same.
 */
const suite = (videoAPIName: SupportedVideoAPIs, videoUrl: URL, videoId: string, expectedVideoDuration: number): void => {
  describe(`${videoAPIName}, `, () => {
    let videoPlayer: VideoPlayer;

    it(`Init ${videoAPIName}`, () => {
      logger.info(`Init ${videoAPIName}`);
      videoPlayer = tu.createPlayer(videoUrl,
                                    {},
                                    undefined
      );
      expect(videoPlayer.getVideoId())
      .toEqual(videoId, "VideoId matches the expected");
      expect((videoPlayer as any).api)
      .toEqual(videoAPIName, "VideoAPI matches the expected");

      expect($("#youtube-video-player0").prop("nodeName"))
      .toBe("DIV", "Freshly created VideoPlayer has unaltered root element");
    });

    describe(`${videoAPIName} accessors, `, () => {
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

      it("load video, test accessors when Player subsystem is initializing", () => {
        logger.info("load video, test accessors when Player subsystem is initializing");
        const timeouts = {
          interval: 0,
          repetitions: 0,
        };

        expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.notLoaded, "Given the Player is not loaded");
        const promise = videoPlayer.loadVideo()
        .then((vapi: VideoPlayer) => {
          window.clearInterval(timeouts.interval);
          expect(vapi.getStatus()).toBe(VideoPlayerStatus.cued,           "Finally Video is loaded");
        });

        //At this time YouTube player internals are in an inconsistent state and getStatus() can easily throw errors if not handled properly
        //  (this.ytPlayer.getPlayerState is not a function)
        timeouts.interval = window.setInterval(() => {
          if (timeouts.repetitions++ > 50) {
            window.clearInterval(timeouts.interval);
          }
          expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cueing,  `${timeouts.repetitions}:While the Player inits, status is cueing`);
          expect(videoPlayer.getDuration()).toBe(undefined,               `${timeouts.repetitions}:While the Player inits, duration is undefined`);
          expect(videoPlayer.getPosition()).toBe(undefined,               `${timeouts.repetitions}:While the Player inits, position is undefined`);
          expect(videoPlayer.getVolume()).toBe(undefined,                 `${timeouts.repetitions}:While the Player inits, volume is undefined`);
        }, 10);

        return promise;
      });

      it("VideoPlayer injected into the given HTML element", () => {
        const expected: string = videoAPIName === SupportedVideoAPIs.HTML5Video ? "VIDEO" :
                                 videoAPIName === SupportedVideoAPIs.YouTube ? "IFRAME" :
                                 "Don't know what is expected?";
        expect(
          $("#youtube-video-player0")
          .prop("nodeName")
        )
        .toEqual(expected);
      });

      it("getDuration() when video is loaded", () => {
        expect(videoPlayer.getDuration()).toBe(expectedVideoDuration);
      });
      it("getPosition() when video is loaded", () => {
        expect(videoPlayer.getPosition()).toBe(0);
      });
      it("getStatus() when video is loaded", () => {
        expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.cued);
      });
      //Player implementations set|get the volume asynchronously or synchronously...
      it(`setVolume() when video is loaded for ${videoAPIName}`, (done) => {
        //HTML5 is synchronous, which is very nice.
        if (videoAPIName === SupportedVideoAPIs.HTML5Video) {
          expect(videoPlayer.getVolume()).toBe(66, "Then setVolume() triggered before video was loaded, gets the VideoAPI volume set.");
          expect(videoPlayer.setVolume(88)).toBe(undefined, "Given setVolume() set volume normally.");
          expect(videoPlayer.getVolume()).toBe(88, "Then getVolume() returns the recently set volume.");
          done();
        //YouTube IFrame is asynchronous with no way of knowing when the volume is actually set. This might not make any difference, but is a pain to test.
        } else if (videoAPIName === SupportedVideoAPIs.YouTube) {
          window.setTimeout(() => { //Listen for the volume change to update, which is triggered after video loading. Hoping to get timings right.
            expect(videoPlayer.getVolume()).toBe(66, "Then setVolume() triggered before video was loaded, gets the VideoAPI volume set.");
          }, 100);
          window.setTimeout(() => {
            expect(videoPlayer.setVolume(88)).toBe(undefined, "Given setVolume() set volume normally.");
          }, 150);
          window.setTimeout(() => { //Listen for the volume change to update, which is triggered after video loading. Hoping to get timings right.
            expect(videoPlayer.getVolume()).toBe(88, "Then getVolume() returns the recently set volume.");

            done();
          }, 250);
        } else {
          expect(videoAPIName).toBe("API not known?? Prepare test for the new api.");
        }
      });
      it("can do actions when video is loaded", () => {
        expect(videoPlayer.canPause()).toBe(false, "Then canPause() is false");
        expect(videoPlayer.canStart()).toBe(true, "Then canStart() is true");
        expect(videoPlayer.canStop()).toBe(false, "Then canStop() is false");
      });
    });

    describe(`${videoAPIName} pausing, `, () => {
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

    it(`${videoAPIName} Destroy`, () => {
      logger.info(`${videoAPIName} Destroy`);
      tu.destroy();
    });
  });
};

// Run the test suite for different Video APIs
suite(SupportedVideoAPIs.HTML5Video, new URL(`http://localhost:5001/${localVideo}`),         `http://localhost:5001/${localVideo}`, 25.643);
suite(SupportedVideoAPIs.YouTube,    new URL("https://www.youtube.com/watch?v=d1mX_MBz0HU"), "d1mX_MBz0HU",                         3923);
