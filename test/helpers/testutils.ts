import * as $ from "jquery";

import { LoggerManager } from "skicker-logger-manager";
import { VideoPlayer } from "../../src/VideoPlayer";

import * as dom from "./dom";
import { IVideoAPIOptions, VideoAPI, VideoPlayerStatus } from "../../src/VideoAPI";

const logger = LoggerManager.getLogger("Skicker.testutils");

/**
 * Set this global module-level root Vue instance when starting to use this utility suite for a test case.
 * This helps cut parameter passing to test wrappers and makes reading the tests cases smooth as ice.
 */
let vp: VideoPlayer;

/**
 * Call this before using this test utility suite
 * @param root instance to be the basis of css selector lookups and othe tests
 */
export const init = (vipa: VideoPlayer) => {
  vp = vipa;
};

/**
 * Used to wrap a nonError-based error notifications to proper Exceptions so the testing framework can properly detect Promise failures.
 * @param err
 */
export const errorize = (err: any) => {
  if (err instanceof Error) {
    throw err;
  } else {
    throw new Error(err);
  }
};

/**
 *
 * @param url Automatically create a test VideoPlayer and init the testutils-package with it.
 * @param opts
 * @param elementId
 */
export const createPlayer = (url: string|URL, opts?: IVideoAPIOptions, elementId?: string): VideoPlayer => {
  try {
    if (!elementId) {
      elementId = "0";
    }
    if (!(url instanceof URL)) {
      url = new URL(url);
    }
    if (!opts) {
      opts = {};
    }

    const vpElement: HTMLElement = dom.appendBodyElement("div", `youtube-video-player${elementId}`, "video-player");

    const videoPlayer =  new VideoPlayer(vpElement, opts, url);
    expect(videoPlayer)
    .toEqual(jasmine.any(VideoPlayer)); //videoPlayer is a VideoPlayer
    init(videoPlayer);

    return videoPlayer;

  } catch (err) {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  }
};

/**
 * Seek the VideoPlayer to given position and assert we are within the given tolerance of the position
 * @param pos
 * @param tolerance
 */
export const seek = (pos: number, tolerance: number): Promise<VideoAPI> =>
  vp
  .seekVideo(pos)
  .then((vapi: VideoAPI) => {

    const pos: number = vp.getVideoAPI().getPosition();
    expect(pos).toBeGreaterThanOrEqual(pos - tolerance);
    expect(pos).toBeLessThanOrEqual(pos + tolerance);

    return vapi;
  })
  .catch((err) => {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  });

export const start = (): Promise<VideoAPI> =>
  vp.startVideo()
  .then((vapi: VideoAPI) => {
    expect(vp.getStatus())
    .toBe(VideoPlayerStatus.playing);

    return vapi;
  })
  .catch((err) => {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  });

export const destroy = (): void => {
  try {
    const el = vp.getRootElement();
    vp.destroy();

    expect($("body").find(el)[0]).toBe(undefined);
    expect(vp.getVideoAPI()).toBe(undefined);

    vp = undefined;

  } catch (err) {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  }
};

