import { isOldEdge, isSafari } from "./utils/agent";

/**
 * @ignore
 */
const AudioContextClass = <typeof AudioContext>((window as any).AudioContext || (window as any).webkitAudioContext || (window as any).mozAudioContext || (window as any).msAudioContext || (window as any).oAudioContext);

/**
 * @ignore
 */
interface TrackCache {
  track: MediaStreamTrack
  mediaStream: MediaStream
  sourceNode: MediaStreamAudioSourceNode
  gainNode: GainNode
}

/**
 * @ignore
 */
const BASE = 128;

// todo - use decorator to validate track

/**
 * @example
 * ```
 * import AudioTrackMixer from 'audio-track-mixer';
 * ```
 */
export default class AudioTrackMixer {
  private audioContext: AudioContext;
  private destinationNode: MediaStreamAudioDestinationNode;
  private caches: Map<string, TrackCache> = new Map();

  private analyserSourceNode: MediaStreamAudioSourceNode;
  private analyser: AnalyserNode
  private timeDomainData: Uint8Array

  /**
   * Create an audio track mixer / 创建一个音轨合并器
   * 
   * @returns An audio track mixer / 一个音轨合并器
   * @throws Throw an error if the browser does not support to mix audio track / 如果浏览器不支持音轨合并，将抛出错误
   * @example
   * ```
   * const mixer = new AudioTrackMixer();
   * ```
   */
  constructor() {
    if (!AudioContextClass) {
      throw new Error('the environment doesnot support to mix audio track');
    }

    this.audioContext = new AudioContextClass();

    // some browser may not support to mix audio track, such as Edge 18.xxx
    if (!this.audioContext.createMediaStreamDestination
      || typeof this.audioContext.createMediaStreamDestination !== 'function') {
      throw new Error('the environment doesnot support to mix audio track');
    }

    this.destinationNode = this.audioContext.createMediaStreamDestination();

    const outStream = this.destinationNode.stream;
    this.analyserSourceNode = this.audioContext.createMediaStreamSource(outStream);
    this.analyser = this.audioContext.createAnalyser();
    this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyserSourceNode.connect(this.analyser);

    // hack - safari 浏览器（desktop, mobile未知) 切换屏幕时，Audio 被关闭的问题
    this.audioContext.onstatechange = () => {
      if ((this.audioContext as any).state === 'interrupted') {
        this.audioContext.resume();
      }
    }
  }

  /**
   * Add an audio track ([MediaStreamTrack](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack)) into the mixer. / 向合并器添加一个音轨 ([音轨](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaStreamTrack))
   * 
   * @param track - An audio track / 一个音轨
   * @returns Return the mixer itself, so it support the chain invoke. / 返回音轨合并器本身以支持链式调用
   * @throws Throw an error if the track is not an audio kind MediaStreamTrack or it has already been added. / 添加的非合法音轨或已添加过该音轨时将抛出错误
   * @example
   * ```
   * mixer.addTrack(trackA);
   * mixer.addTrack(trackB);
   * ```
   *
   * @note Because of the chain invoke, you can also use it just like the following way: / 因支持链接调用，所以你也可以像下面这样使用:
   *
   * ```
   * mixer.addTrack(trackA).addTrack(trackB);
   * ```
   */
  addTrack(track: MediaStreamTrack): AudioTrackMixer {
    if (!track.kind || track.kind !== 'audio') {
      throw new Error('not an audio track');
    }
    const cache: TrackCache | undefined = this.caches.get(track.id);
    if (cache) {
      throw new Error(`audio track (id: ${track.id}) has already been added`);
    }

    const mediaStream: MediaStream = new MediaStream();
    mediaStream.addTrack(track);
    const sourceNode: MediaStreamAudioSourceNode = this.audioContext.createMediaStreamSource(mediaStream);
    const gainNode: GainNode = this.audioContext.createGain();
    sourceNode.connect(gainNode);
    gainNode.connect(this.destinationNode);
    this.caches.set(track.id, {
      track,
      mediaStream,
      sourceNode,
      gainNode
    });
    return this;
  }

  /**
   * Remove an audio track from the mixer. / 将某条音轨从合并器中移除
   * 
   * @param track - The audio track added into the mixer. / 已合并的音轨
   * @returns Return the mixer itself to support the chain invoke. / 返回合并器本身以支持链式调用
   * @throws Throw an error if the track is not an audio kind MediaStreamTrack. / 传入非合法音轨时将抛出错误
   * @example
   * ```
   * mixer.removeTrack(trackA);
   * mixer.removeTrack(trackB);
   * ```
   *
   * @note Because of the chain invoke, you can also use it just like the following way: / 因支持链接调用，所以你也可以像下面这样使用:
   * 
   * ```
   * mixer.removeTrack(trackA).removeTrack(trackB);
   * ```
   */
  removeTrack(track: MediaStreamTrack): AudioTrackMixer {
    if (!track.kind || track.kind !== 'audio') {
      throw new Error('not an audio track');
    }
    const cache: TrackCache | undefined = this.caches.get(track.id);

    if (cache) {
      cache.gainNode.disconnect(this.destinationNode);
      cache.sourceNode.disconnect(cache.gainNode);
      this.caches.delete(track.id);
    }
    return this;
  }

  /**
   * Set volume of the track added into the mixer. / 调节原始音轨的输出音量
   * 
   * @param track - The track added into the mixer / 指定音轨
   * @param volume - Volume range [0, 100] / 指定音量，可设范围 [0, 100]
   * @throws Throw an error if the track is not an audio kind MediaStreamTrack / 当输入非合法音轨时将抛出错误
   * 
   * @example
   * ```
   * mixer.setTrackVolume(trackA, 50);
   * ```
   */
  setTrackVolume(track: MediaStreamTrack, volume: number): void {
    if (!track.kind || track.kind !== 'audio') {
      throw new Error('not an audio track');
    }
    const cache: TrackCache | undefined = this.caches.get(track.id);

    if (cache) {
      cache.gainNode.gain.value = volume / 100;
    }
  }

  /**
   * Mute a track. / 将某条音轨静音
   * 
   * @param track - The track added into the mixer / 指定音轨
   * @returns True if mute successfully, False when failure / 成功时返回 true，失败时返回 false
   * @throws Throw an error if the track is not an audio kind MediaStreamTrack / 传入的非合法音轨时将抛出错误
   * 
   * @example
   * ```
   * const result = mixer.muteTrack(trackA);
   * ```
   */
  muteTrack(track: MediaStreamTrack): boolean {
    if (!track.kind || track.kind !== 'audio') {
      throw new Error('not an audio track');
    }
    const cache: TrackCache | undefined = this.caches.get(track.id);
    if (cache) {
      cache.track.enabled = false;
      return true;
    }
    return false;
  }

  /**
   * Unmute the track added into the mixer. / 将某条音轨取消静音
   * 
   * @param track - The track added into the mixer / 指定音轨
   * @returns True if unmute successfully, False when failure / 成功时返回 true, 失败时返回 false
   * @throws Throw an error if the track is not an audio kind MediaStreamTrack / 传入的非合法音轨时将抛出错误
   * 
   * @example
   * ```
   * const result = mixer.unmuteTrack(trackA);
   * ```
   */
  unmuteTrack(track: MediaStreamTrack): boolean {
    if (!track.kind || track.kind !== 'audio') {
      throw new Error('not an audio track');
    }
    const cache: TrackCache | undefined = this.caches.get(track.id);
    if (cache) {
      cache.track.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Get all original tracksr (not the mixed one). / 获取所有原始音轨
   * 
   * @returns Return all original tracks / 返回所有原始音轨
   * @example
   * ```
   * const tracks = mixer.getTracks();
   * ```
   */
  getTracks(): MediaStreamTrack[] {
    const tracks: MediaStreamTrack[] = [];
    this.caches.forEach(function (cache: TrackCache) {
      tracks.push(cache.track);
    });
    return tracks;
  }

  /**
   * Get the mixed track from the mixer after mixing tracks. / 获取经过合并器合并后的音轨
   * 
   * @returns The mixed audio track / 合并后的音轨
   * @example
   * ```
   * const mixedTrack = mixer.getMixedTrack();
   * ```
   */
  getMixedTrack(): MediaStreamTrack {
    return this.destinationNode.stream.getAudioTracks()[0];
  }

  /**
   * Get the volume of the mixed track. / 获取合并后音轨的音量
   * 
   * @returns Volume range [0, 100] / 返回的音量范围为 [0, 100]
   * @example
   * ```
   * const volume = mixer.getMixedTrackVolume();
   * ```
   */
  getMixedTrackVolume(): number {
    let max = 0;
    if (this.analyser) {
      this.analyser.getByteTimeDomainData(this.timeDomainData);
      this.timeDomainData.forEach(item => {
        max = Math.max(max, Math.abs(item - BASE));
      });
    }
    return Math.floor((max / BASE) * 100);
  }

  /**
   * Get media stream which contains mixed audio track, you can play it directly. / 直接获取包含合并后音轨的媒体流，可用于直接播放
   * 
   * @returns The media stream includes the mixed audio track / 返回媒体流
   * @example
   * ```
   * const audio = new Audio();
   * audio.srcObject = mixer.getMixedMediaStream();
   * ```
   */
  getMixedMediaStream(): MediaStream {
    return this.destinationNode.stream;
  }

  /**
   * Clear cache of the mixer and destroy it. / 销毁合并器
   *
   * @returns An promise
   * @example
   * ```
   * mixer
   *  .destroy()
   *  .catch(err => {
   *    ...
   *  });
   * ```
   */
  destroy(): Promise<void> {
    this.caches.forEach((cache: TrackCache) => {
      cache.gainNode.disconnect(this.destinationNode);
      cache.sourceNode.disconnect(cache.gainNode);
    });
    this.caches.clear();
    return this.audioContext.close();
  }

  /**
   * Get all audio tracks from a [MediaStream](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream). / 直接从 [媒体流](https://developer.mozilla.org/zh-CN/docs/Web/API/MediaStream) 中提取出所有音频轨道
   * 
   * @param stream A source MediaStream / 一条媒体流
   * @returns An Array of audio kind MediaStreamTrack / 包含若干个音轨的数组
   * @example
   * ```
   * const audioTracks = AudioTrackMixer.getTracks(stream);
   * ```
   */
  static getTracks(stream: MediaStream): MediaStreamTrack[] {
    return stream.getAudioTracks();
  }

  /**
   * Get audio tracks from an audio element. / 从 audio 元素中提取出音轨
   *
   * @param audio - An audio element (HTMLAudioElement). / 一个 audio 元素
   * @returns Audio tracks / 若干音轨
   * @example
   * ```
   * const audio = new Audio(xxx.mp3);
   * audio.addEventListener('loadeddata', () => {
   *   const audioTracks = AudioTrackMixer.getTracksFromAudioElement(audio);
   * });
   * ```
   * @note Audio element must has already loaded data. / 提取前须确保音频数据已加载
   */
  static getTracksFromAudioElement(audio: HTMLAudioElement): MediaStreamTrack[] {
    if (Audio.prototype.captureStream) {
      return (audio as any).captureStream().getAudioTracks();
    } else if (Audio.prototype.mozCaptureStream) {
      return (audio as any).mozCaptureStream().getAudioTracks()[0];
    } else if (isSafari() || isOldEdge()) {
      return (audio as any).audioTracks;
    }
    return [];
  }
}

/**
 * The version of AudioTrackMixer / 音轨合并器的版本号
 * 
 * @example
 * ```
 * import { version } from 'audio-track-mixer';
 * ```
 */
//@ts-ignore
const version: string = __VERSION__;

export { version };
