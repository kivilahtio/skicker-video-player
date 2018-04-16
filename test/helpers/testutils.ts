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

    //VideoPlayer not yet injected into the given HTML element
    const htmlElementsCreated: number =
      $(vpElement)
      .find("*")
      .length;
    expect(htmlElementsCreated)
      .toEqual(0);

    return videoPlayer;

  } catch (err) {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  }
};

/**
 * Seek the VideoPlayer to given position and assert we are within the given tolerance of the position
 * @param pos seconds as a number, or a h:m:s || m:s notation as string
 * @param tolerance
 */
export const seek = (pos: number | string, tolerance: number): Promise<VideoPlayer> => {
  if (typeof(pos) === "string") { //This is a position like 1:05:22
    let seconds: number = 0;
    const hms: string[] = pos.split(":");
    if (hms.length === 3) { //hms
      seconds =  Number(hms[0]) * 3600;
      seconds += Number(hms[1]) * 60;
      seconds += Number(hms[2]);
    } else if (hms.length === 2) { //hms
      seconds =  Number(hms[0]) * 60;
      seconds += Number(hms[1]);
    } else if (hms.length === 1) { //hms
      seconds =  Number(hms[0]);
    }
    pos = seconds;
  }
  return vp
  .seekVideo(pos)
  .then((vapi: VideoPlayer) => {

    const pos: number = (vp as any).videoAPI.getPosition();
    expect(pos).toBeGreaterThanOrEqual(pos - tolerance, "Then video is seeked");
    expect(pos).toBeLessThanOrEqual(pos + tolerance, "Then video is seeked");

    return vapi;
  })
  .catch((err) => {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  });
};

export const start = (): Promise<VideoPlayer> =>
  vp.startVideo()
  .then((vapi: VideoPlayer) => {
    expect(vp.getStatus())
    .toBe(VideoPlayerStatus.started, "Then Video is started");

    return vapi;
  })
  .catch((err) => {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  });

export const pause = (): Promise<VideoPlayer> =>
  vp.pauseVideo()
  .then((vapi: VideoPlayer) => {
    expect(vp.getStatus()).toBe(VideoPlayerStatus.paused, "Then Video is paused");

    return vapi;
  })
  .catch((err) => {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  });

export const stop = (): Promise<VideoPlayer> =>
  vp.stopVideo()
  .then((vapi: VideoPlayer) => {
    expect(vp.getStatus()).toBe(VideoPlayerStatus.stopped, "Then Video is 'stopped'");

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
    expect((vp as any).videoAPI).toBe(undefined);

    vp = undefined;

  } catch (err) {
    err = errorize(err);
    logger.fatal(err, err.stack);
    throw err;
  }
};

