import ImagePicker from 'react-native-image-crop-picker';
import { colors } from '../../theme';
import { fileUri, pickerFailure } from '../media/picker';

export type PhotoSource = 'camera' | 'library';

// Profile photos are stored 4:5 at 1080 x 1350 (docs/05), JPEG, compressed on the phone.
export const photoOutput = { width: 1080, height: 1350, jpegQuality: 0.8 };
const cropper = {
  width: photoOutput.width,
  height: photoOutput.height,
  compressImageQuality: photoOutput.jpegQuality,
  forceJpg: true,
  cropperToolbarTitle: 'Crop your photo',
  cropperActiveWidgetColor: colors.orchid,
  cropperToolbarWidgetColor: colors.orchid,
  cropperStatusBarLight: true,
} as const;

const options = { mediaType: 'photo', cropping: true, ...cropper } as const;

// The cropped photos' file URIs, newest choice first, or none when the Member backs out.
// The camera takes one. The gallery takes up to `limit`, since its picker offers multi-select
// anyway; the library ignores `cropping` for a multiple choice, so each is cropped in turn
// afterwards. Backing out of the cropper keeps the photos cropped before it (#197).
export type PickedPhotos = {
  // The cropped files, at most `limit` of them.
  uris: string[];
  // How many the Member chose, which can be more than fit if the picker ignores `maxFiles`.
  chosen: number;
};

export async function pickPhotos(
  source: PhotoSource,
  limit: number,
): Promise<PickedPhotos> {
  if (source === 'camera') {
    const one = await pickPhoto('camera');
    return { uris: one ? [one] : [], chosen: one ? 1 : 0 };
  }
  let chosen;
  try {
    chosen = await ImagePicker.openPicker({
      mediaType: 'photo',
      multiple: true,
      maxFiles: Math.max(limit, 1),
    });
  } catch (error) {
    const failure = pickerFailure(
      error,
      "We couldn't open your photos. Try again.",
    );
    if (failure) {
      throw failure;
    }
    return { uris: [], chosen: 0 };
  }
  const cropped: string[] = [];
  for (const image of chosen.slice(0, Math.max(limit, 1))) {
    try {
      const out = await ImagePicker.openCropper({
        ...cropper,
        path: image.path,
        mediaType: 'photo',
      });
      cropped.push(fileUri(out.path));
    } catch (error) {
      const failure = pickerFailure(
        error,
        "We couldn't open that photo. Try another one.",
      );
      // A photo the Member backs out of cropping is simply left behind.
      if (failure && cropped.length === 0) {
        throw failure;
      }
      break;
    }
  }
  return { uris: cropped, chosen: chosen.length };
}

// The cropped photo's file URI, or null when the Member backs out.
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  try {
    const image =
      source === 'camera'
        ? await ImagePicker.openCamera(options)
        : await ImagePicker.openPicker(options);
    return fileUri(image.path);
  } catch (error) {
    const failure = pickerFailure(
      error,
      "We couldn't open that photo. Try another one.",
    );
    if (failure) {
      throw failure;
    }
    return null;
  }
}
