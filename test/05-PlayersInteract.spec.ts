import * as $ from "jquery";
import { YouTubeVideo } from "../src/VideoAPI/YouTubeVideo";
import { SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "../src/VideoAPI";
import { VideoPlayer } from "../src/VideoPlayer";
import { BadParameterException } from "../src/Exception/BadParameter";
import { UnknownVideoSourceException } from "../src/Exception/UnknownVideoSource";
import * as dom from "./helpers/dom";
import * as tu from "./helpers/testutils";

import { LoggerManager } from "skicker-logger-manager";
const logger = LoggerManager.getLogger("Skicker.test.05");

jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

describe("Two VideoPlayers load simultaneously,", () => {
  let videoPlayer1: VideoPlayer;
  let videoPlayer2: VideoPlayer;

  it("Init VideoPlayer1", () => {
    logger.info("Init VideoPlayer1");
    videoPlayer1 = tu.createPlayer(new URL('https://www.youtube.com/watch?v=C0DPdy98e4c'),
                                  {},
                                  "11"
    );
  });

  it("Init VideoPlayer2", () => {
    logger.info("Init VideoPlayer2");
    videoPlayer2 = tu.createPlayer(new URL('https://www.youtube.com/watch?v=ucZl6vQ_8Uo'),
                                  {},
                                  "22"
    );
  });

  it("load videos concurrently", () => {
    logger.info("load videos concurrently");
    expect(videoPlayer1.getStatus()).toBe(VideoPlayerStatus.notLoaded, "Given a fresh VideoPlayer1");
    expect(videoPlayer2.getStatus()).toBe(VideoPlayerStatus.notLoaded, "Given a fresh VideoPlayer2");

    const promises = Array<Promise<VideoPlayer>>();
    promises.push(videoPlayer1.loadVideo()
    .then((vp: VideoPlayer) => {
      expect(vp.getStatus()).toBe(VideoPlayerStatus.cued, "Then VideoPlayer1 is cued");
      return vp;
    }));
    promises.push(videoPlayer2.loadVideo()
    .then((vp: VideoPlayer) => {
      expect(vp.getStatus()).toBe(VideoPlayerStatus.cued, "Then VideoPlayer2 is cued");
      return vp;
    }));

    return Promise.all(promises); //Once all promises have resolved, release the test
  });

  it("Destroy", () => {
    logger.info("Destroy");
    tu.destroy(videoPlayer1);
    tu.destroy(videoPlayer2);
  });
});
