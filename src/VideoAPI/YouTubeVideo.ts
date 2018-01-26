/**
 * https://developers.google.com/youtube/iframe_api_reference
 * https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/youtube/index.d.ts is in tsconfig.json to make typings available
 */

import { VideoAPI } from "../VideoAPI";

enum YouTubeIFramePlayerEvents {
  onReady,
  onStateChange,
}

type YouTubeIFramePlayerEventHandler = (event: Event) => void;

export class YouTubeVideo extends VideoAPI{

  private ytplayer: YT.Player;

  public constructor(rootElement: Element) {
    super();
    this.initIFrameAPI();
    this.createPlayer(rootElement);
  }

  public loadVideo(id: string): Promise<YouTubeVideo> {
    return new Promise<YouTubeVideo> ((resolve, reject): void => {

    });
  }
  public startVideo(): Promise<YouTubeVideo> {
    return new Promise<YouTubeVideo> ((resolve, reject): void => {

    });
  }

  /**
   * 3. This function creates an <iframe> (and YouTube player) after the API code downloads.
   * @param rootElement where to inject the YouTube Player
   */
  private createPlayer(rootElement: Element,
                       eventHandlers?: YT.Events,
                      ):void {

    (window as any).onYouTubeIframeAPIReady = (): void => {
      this.ytplayer = new YT.Player(rootElement.id, {
        events: {
          onReady: onPlayerReady,
          onStateChange: onPlayerStateChange,
        },
        height: 390,
        videoId: "M7lc1UVf-VE",
        width: 640,
      });
    }

    // 4. The API will call this function when the video player is ready.
    const onPlayerReady: YT.PlayerEventHandler<YT.PlayerEvent> = (event:YT.PlayerEvent): void => {
      event.target.playVideo();
    };

    // 5. The API calls this function when the player's state changes.
    //    The function indicates that when playing a video (state=1),
    //    the player should play for six seconds and then stop.
    let done: boolean = false;
    const onPlayerStateChange: YT.PlayerEventHandler<YT.OnStateChangeEvent> = (event: YT.OnStateChangeEvent): void => {
      if (event.data == YT.PlayerState.PLAYING && !done) {
        const timeInMillis: number = 6000;
        setTimeout(stopVideo, timeInMillis);
        done = true;
      }
    }
    const stopVideo: () => void = (): void => {
      this.ytplayer.stopVideo();
    }
  }

  /**
   * 2. This code loads the IFrame Player API code asynchronously.
   * Makes sure the API code is loaded once even when using multiple players on the same document
   */
  private initIFrameAPI(): void {
    if (! document.getElementById("youtube-iframe_api")) {
      const tag: Element = document.createElement("script");

      tag.setAttribute("src", "https://www.youtube.com/iframe_api");
      tag.setAttribute("id", "youtube-iframe_api");
      const firstScriptTag: Element = document.getElementsByTagName("script")[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }
}

/*import { YouTubePlayer } from "youtube-player";

export class YouTubeVideoPlayer extends VideoAPI {

  public constructor(rootElement: Element) {
    super();
    let player;

    player = YouTubePlayer('video-player');

    // 'loadVideoById' is queued until the player is ready to receive API calls.
    player.loadVideoById('M7lc1UVf-VE');

    // 'playVideo' is queue until the player is ready to received API calls and after 'loadVideoById' has been called.
    player.playVideo();

    // 'stopVideo' is queued after 'playVideo'.
    player
        .stopVideo()
        .then(() => {
            // Every function returns a promise that is resolved after the target function has been executed.
        });
  }

  public loadVideo(id: string): Promise<YouTubeVideo> {
    return new Promise<YouTubeVideo> ((resolve, reject): void => {

    });
  }
  public startVideo(): Promise<YouTubeVideo> {
    return new Promise<YouTubeVideo> ((resolve, reject): void => {

    });
  }
}
*/
