import { IVideoAPIOptions, SupportedVideoAPIs, VideoAPI, VideoPlayerStatus } from "./VideoAPI";
export declare class VideoPlayer {
    private api;
    private options;
    private rootElement;
    private videoAPI;
    private videoId;
    private youTubeURLParsingRegexp;
    constructor(rootElement: Element, options?: IVideoAPIOptions);
    /**
     * Release this player and all assets to garbage collection (hopefully)
     */
    destroy(): void;
    getStatus(): VideoPlayerStatus;
    getVideoAPI(): VideoAPI;
    getVideoId(): string;
    /**
     * @param id Video id of the remote service
     * @param api A supported video source API name. You can try casting a dynamic variable using "let api: SupportedVideoAPIs = SupportedVideoAPIs['YouTube'];"
     * @param options Options to pass to the video player implementation
     */
    loadVideo(id: string, api: SupportedVideoAPIs, options?: IVideoAPIOptions): Promise<VideoAPI>;
    /**
     * Loads a video into the given root element from a remote service.
     *
     * @param url Full URL to the video source.
     * @param options Options to pass to the video player implementation
     */
    loadVideoFromURL(url: URL, options?: IVideoAPIOptions): Promise<VideoAPI>;
    pauseVideo(): Promise<VideoAPI>;
    setPlaybackRate(rate: number): Promise<VideoAPI>;
    startVideo(): Promise<VideoAPI>;
    stopVideo(): Promise<VideoAPI>;
    private createVideoAPI();
    /**
     * given the URL of the video, decides which VideoAPI to use and extracts other available information
     * such as the video id
     *
     * @param url The URL of the video to be played
     */
    private parseURL(url);
}
