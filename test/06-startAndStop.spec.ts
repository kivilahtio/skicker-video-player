import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.06");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Video with specific start and end positions,", () => {
  let videoPlayer: VideoPlayer;
  const start = 3;
  const end = 5;

  it("Init VideoPlayer to play from position 3 until position 5", () => {
    logger.info("Init VideoPlayer1");
    videoPlayer = tu.createPlayer(new URL('https://www.youtube.com/watch?v=C0DPdy98e4c'),
                                  {
                                    start,
                                    end,
                                  },
    );
  });

  it("Start-action starts from the desired start position", () => {
    logger.info("Start-action starts from the desired start position");
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.notLoaded, "Given a fresh VideoPlayer");
    expect(videoPlayer.getPosition()).toBe(undefined,                 "With undefined position");
    expect(videoPlayer.getOptions().start).toBe(start,                "And start position");
    expect(videoPlayer.getOptions().end).toBe(end,                    "And end position");

    return videoPlayer.startVideo()
    .then((vp: VideoPlayer) => {
      expect(vp.getStatus()).toBe(VideoPlayerStatus.started,          "When VideoPlayer is started");
      expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(start, "Then play starts from the given start position (>=)");
      expect(videoPlayer.getPosition()).toBeLessThanOrEqual(start+0.1,"Then play starts from the given start position (<=)");
      return vp;
    });
  });

  it("Play automatically ends when end position is reached", (done) => {
    logger.info("Play automatically ends when end position is reached");
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.started,   "Given VideoPlayer is playing");

    //Set timeout to detect that the video has stopped playing
    window.setTimeout(() => {
      expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.ended,   "When Video play has ended");
      expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(end-0.1,"Then play stopped at the given stop position (>=)");
      expect(videoPlayer.getPosition()).toBeLessThanOrEqual(end+0.1,  "Then play stopped at the given stop position (<=)");
      done();
    //Precisely at the same time as the video stops playing, the play has stopped, but the iternal status of the YouTube Player is still shifting to ended.
    }, (end - start) * 1000 + 500); //500ms padding to give time to transition to ended
  });

  /** Uncertain what is the desired behaviour here? */
  it("New Start-action starts from position 0, NOT THE PARAMETRIZED START POSITION?", () => {
    logger.info("New Start-action starts from position 0, NOT THE PARAMETRIZED START POSITION?");
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.ended,     "Given an ended VideoPlayer");
    expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(end-0.1, "With ended position (>=)");
    expect(videoPlayer.getPosition()).toBeLessThanOrEqual(end+0.1,    "With ended position (<=)");

    return videoPlayer.startVideo()
    .then((vp: VideoPlayer) => {
      expect(vp.getStatus()).toBe(VideoPlayerStatus.started,          "When VideoPlayer is started");
      expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(0,     "Then play starts from the very beginning (>=)");
      expect(videoPlayer.getPosition()).toBeLessThanOrEqual(0.1,      "Then play starts from the very beginning (<=)");
      return vp;
    });
  });
/* TODO:: Behaviour here is not acutely necessary. Needless to say, timing and positioning should be managed from without the VideoPlayer
  it("Pause after 500ms", (done) => {
    logger.info("Pause after 500ms");
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.buffering,       "Given a started VideoPlayer, which is buffering the new position");

    window.setTimeout(() => {
      videoPlayer.pauseVideo()
      .then((vp: VideoPlayer) => {
        expect(vp.getStatus()).toBe(VideoPlayerStatus.paused,               "When VideoPlayer is paused");
        expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(5,         "Then play has continued 500ms (>=)");
        expect(videoPlayer.getPosition()).toBeLessThanOrEqual(5.1,          "Then play has continued 500ms (<=)");
        done();
      })
      .catch((err) => {
        logger.error(err);
        expect(err).toBe(undefined);
        done();
      });
    }, 500);
  });

  it("Start continues from pause", (done) => {
    logger.info("Start continues from pause");
    expect(videoPlayer.getStatus()).toBe(VideoPlayerStatus.paused,          "Given a paused VideoPlayer");

    window.setTimeout(() => {
      videoPlayer.startVideo()
      .then((vp: VideoPlayer) => {
        expect(vp.getStatus()).toBe(VideoPlayerStatus.started,              "When VideoPlayer is started");
        expect(videoPlayer.getPosition()).toBeGreaterThanOrEqual(5, "Then play continues (>=)");
        expect(videoPlayer.getPosition()).toBeLessThanOrEqual(5.1,  "Then play continues (<=)");
        done();
      })
      .catch((err) => {
        logger.error(err);
        expect(err).toBe(undefined);
        done();
      });
    }, 500);
  });
*/

  it("Destroy", () => {
    logger.info("Destroy");
    tu.destroy(videoPlayer);
  });
});
