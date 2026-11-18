import { App } from '@capacitor/app';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { StatusBar, Style } from '@capacitor/status-bar';

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export async function loadPref(key: string): Promise<string | null> {
  let localVal: string | null = null;
  try {
    localVal = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  } catch {
    localVal = null;
  }

  if (isNativeApp()) {
    try {
      const { value } = await Preferences.get({ key });
      if (value) {
        try {
          if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
        } catch {
          // ignore storage quota errors
        }
        return value;
      }
    } catch {
      // fall through to localVal
    }
  }
  return localVal;
}

export async function savePref(key: string, value: string): Promise<void> {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage errors
  }

  if (isNativeApp()) {
    try {
      await Preferences.set({ key, value });
    } catch {
      // ignore native pref failure
    }
  }
}

export async function configureNativeAppShell(
  onBackPress?: () => boolean
): Promise<() => void> {
  if (!isNativeApp()) return () => {};

  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // ignore
  }
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch {
    // Android 15+ enforces edge-to-edge and ignores overlaysWebView
  }
  try {
    await StatusBar.setBackgroundColor({ color: '#14171C' });
  } catch {
    // Android 15+ deprecates setBackgroundColor
  }

  let backHandle: { remove: () => Promise<void> } | null = null;
  try {
    backHandle = await App.addListener('backButton', ({ canGoBack }) => {
      const handled = onBackPress?.() ?? false;
      if (!handled) {
        if (canGoBack) {
          window.history.back();
        } else {
          App.minimizeApp().catch(() => {});
        }
      }
    });
  } catch {
    // ignore
  }

  return () => {
    backHandle?.remove().catch(() => {});
  };
}

export async function listenAppRestoredPhoto(
  onRestoredDataUrl: (dataUrl: string, format?: string) => void
): Promise<() => void> {
  if (!isNativeApp()) return () => {};

  try {
    const handle = await App.addListener('appRestoredResult', (result) => {
      if (result.pluginId === 'Camera' && result.success && result.data) {
        const data = result.data as { dataUrl?: string; format?: string };
        if (data.dataUrl) {
          onRestoredDataUrl(data.dataUrl, data.format);
        }
      }
    });
    return () => {
      handle.remove().catch(() => {});
    };
  } catch {
    return () => {};
  }
}

export async function pickImageWithNativeCamera(
  source: 'camera' | 'photos'
): Promise<{ dataUrl: string; fileName: string } | null> {
  try {
    const perm = await Camera.checkPermissions().catch(() => null);
    if (perm) {
      const needed = source === 'camera' ? perm.camera : perm.photos;
      if (needed === 'denied' || needed === 'prompt' || needed === 'prompt-with-rationale') {
        await Camera.requestPermissions({
          permissions: source === 'camera' ? ['camera'] : ['photos'],
        });
      }
    }

    const photo = await Camera.getPhoto({
      quality: 88,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      correctOrientation: true,
      width: 1920,
    });

    if (!photo.dataUrl) return null;
    const ext = photo.format || 'jpg';
    const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    return {
      dataUrl: photo.dataUrl,
      fileName: source === 'camera' ? `現場拍攝_${stamp}.${ext}` : `相簿空間照片_${stamp}.${ext}`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/cancel|user aborted|dismissed/i.test(msg)) {
      return null;
    }
    throw err;
  }
}

export async function saveAndShareNativeFile(
  filename: string,
  content: string,
  dialogTitle = '儲存或分享設計報表'
): Promise<boolean> {
  if (!isNativeApp()) return false;
  const safeName = filename.replace(/[\\/:*?"<>|]/g, '_');
  const res = await Filesystem.writeFile({
    path: `exports/${safeName}`,
    data: content,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  });
  await Share.share({
    title: safeName,
    files: [res.uri],
    dialogTitle,
  });
  return true;
}

export async function shareNativeText(
  title: string,
  text: string,
  dialogTitle = '分享預算明細'
): Promise<boolean> {
  if (!isNativeApp()) return false;
  await Share.share({
    title,
    text,
    dialogTitle,
  });
  return true;
}
