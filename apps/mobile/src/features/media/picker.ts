// Shared by the profile photo picker and the chat media picker (react-native-image-crop-picker).

export const pickerRefusals: Record<string, string> = {
  E_NO_CAMERA_PERMISSION:
    "Allow camera access for MiloJulo in your phone's settings, then try again.",
  E_NO_LIBRARY_PERMISSION:
    "Allow photo access for MiloJulo in your phone's settings, then try again.",
  E_CAMERA_IS_NOT_AVAILABLE: "This phone's camera isn't available.",
};

// The picker's error as copy, or null when the Member backed out.
export function pickerFailure(error: unknown, otherwise: string): Error | null {
  const code = (error as { code?: string }).code ?? '';
  if (code === 'E_PICKER_CANCELLED') {
    return null;
  }
  return new Error(pickerRefusals[code] ?? otherwise);
}

// The picker hands back bare paths on Android; fetch and the players want a file URI.
export const fileUri = (path: string) =>
  path.startsWith('/') ? `file://${path}` : path;
