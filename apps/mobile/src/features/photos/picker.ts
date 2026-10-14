import ImagePicker from 'react-native-image-crop-picker';
import { colors } from '../../theme';

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

const refusals: Record<string, string> = {
  E_NO_CAMERA_PERMISSION:
    "Allow camera access for MiloJulo in your phone's settings, then try again.",
  E_NO_LIBRARY_PERMISSION:
    "Allow photo access for MiloJulo in your phone's settings, then try again.",
  E_CAMERA_IS_NOT_AVAILABLE: "This phone's camera isn't available.",
};

// The cropped photo's file URI, or null when the Member backs out.
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  try {
    const image =
      source === 'camera'
        ? await ImagePicker.openCamera(options)
        : await ImagePicker.openPicker(options);
    return image.path.startsWith('/') ? `file://${image.path}` : image.path;
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'E_PICKER_CANCELLED') {
      return null;
    }
    throw new Error(
      refusals[code] ?? "We couldn't open that photo. Try another one.",
    );
  }
}
