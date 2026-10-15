import ImagePicker from 'react-native-image-crop-picker';
import { colors } from '../../theme';
import { fileUri, pickerFailure } from '../media/picker';

export type PhotoSource = 'camera' | 'library';

// Profile photos are stored 4:5 at 1080 x 1350 (docs/05), JPEG, compressed on the phone.
export const photoOutput = { width: 1080, height: 1350, jpegQuality: 0.8 };
const options = {
  mediaType: 'photo',
  cropping: true,
  width: photoOutput.width,
  height: photoOutput.height,
  compressImageQuality: photoOutput.jpegQuality,
  forceJpg: true,
  cropperToolbarTitle: 'Crop your photo',
  cropperActiveWidgetColor: colors.orchid,
  cropperToolbarWidgetColor: colors.orchid,
  cropperStatusBarLight: true,
} as const;

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
