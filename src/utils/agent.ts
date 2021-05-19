import * as Bowser from 'bowser';

/**
 * @internal
 */
const browser = Bowser.getParser(window.navigator.userAgent);

/**
 * @internal
 */
interface BrowserInfo {
  name: string;
  version: string;
  isMobile: boolean;
  engineName?: string; // "Trident"
  engineVersion?: string; // "7.0"
}

/**
 * @internal
 */
interface SystemInfo {
  name: string; // 系统名
  version: string; // 系统版本
  versionName: string; // 系统版本名
}

/**
 * @internal
 */
export function isMobile(): boolean {
  return browser.getPlatformType() === 'mobile';
}

/**
 * @internal
 */
export function getBrowserInfo(): BrowserInfo {
  const bw = browser.getBrowser();
  const platform = browser.getPlatform();
  const engine = browser.getEngine();
  return {
    name: bw.name || 'unknown',
    version: bw.version || 'unknown',
    isMobile: platform.type === 'mobile',
    engineName: engine.name,
    engineVersion: engine.version,
  } as BrowserInfo;
}

/**
 * @internal
 */
export function getSystemInfo(): SystemInfo {
  const os = browser.getOS();
  return {
    name: os.name || 'unknown',
    version: os.version || 'unknown',
    versionName: os.versionName || 'unknown',
  };
}

/**
 * @internal
 */
export function isSafari(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'safari';
}
/**
 * @internal
 */
export function isChrome(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'chrome';
}
/**
 * @internal
 */
export function isFirefox(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'firefox';
}
/**
 * @internal
 */
export function isEdge(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'microsoft edge';
}
/**
 * @internal
 */
export function isOldEdge(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'microsoft edge' && browserInfo.engineName?.toLocaleLowerCase() !== 'blink';
}
/**
 * @internal
 */
export function isIOS(): boolean {
  const systemInfo = getSystemInfo();
  return systemInfo.name.toLowerCase() === 'ios';
}
/**
 * @internal
 */
export function isMacOS(): boolean {
  const systemInfo = getSystemInfo();
  return systemInfo.name.toLowerCase() === 'macos';
}

/**
 * @internal
 */
export function isWeChat(): boolean {
  const browserInfo = getBrowserInfo();
  return browserInfo.name.toLowerCase() === 'wechat';
}
