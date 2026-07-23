import { File, Directory, Paths } from "expo-file-system";
import { Audio } from "expo-av";

function getRecDir(): Directory {
  return new Directory(Paths.document, "mizo_recordings");
}

function getRecFile(wordId: string): File {
  return new File(getRecDir(), `${wordId}.m4a`);
}

export function hasRecording(wordId: string): boolean {
  return getRecFile(wordId).exists;
}

let activeRecording: Audio.Recording | null = null;

export async function startRecording(): Promise<void> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  activeRecording = recording;
}

export async function stopAndSaveRecording(wordId: string): Promise<string> {
  if (!activeRecording) throw new Error("No active recording");
  await activeRecording.stopAndUnloadAsync();
  const uri = activeRecording.getURI();
  activeRecording = null;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

  if (!uri) throw new Error("Recording URI is null");

  getRecDir().create({ intermediates: true, idempotent: true });
  const dest = getRecFile(wordId);
  await new File(uri).move(dest, { overwrite: true });
  return dest.uri;
}

export async function cancelRecording(): Promise<void> {
  if (!activeRecording) return;
  try { await activeRecording.stopAndUnloadAsync(); } catch {}
  activeRecording = null;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
}

export async function playRecording(wordId: string, onDone?: () => void): Promise<void> {
  const file = getRecFile(wordId);
  if (!file.exists) throw new Error("No recording for this word");

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  const { sound } = await Audio.Sound.createAsync({ uri: file.uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s) => {
    if (s.isLoaded && s.didJustFinish) {
      sound.unloadAsync();
      onDone?.();
    }
  });
}

export function deleteRecording(wordId: string): void {
  const file = getRecFile(wordId);
  if (file.exists) file.delete();
}
