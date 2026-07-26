import AsyncStorage from "@react-native-async-storage/async-storage";

const RECORDINGS_KEY = "mizo_word_recordings";

// expo-av is loaded lazily so old native binaries fail gracefully
let Audio: any = null;
try { Audio = require("expo-av").Audio; } catch {}

async function getMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(RECORDINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

async function saveMap(map: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(RECORDINGS_KEY, JSON.stringify(map));
}

export async function hasRecording(wordId: string): Promise<boolean> {
  const map = await getMap();
  return !!map[wordId];
}

let activeRecording: any = null;

export async function startRecording(): Promise<void> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  activeRecording = recording;
}

export async function stopAndSaveRecording(wordId: string): Promise<void> {
  if (!activeRecording) throw new Error("No active recording");
  await activeRecording.stopAndUnloadAsync();
  const uri = activeRecording.getURI();
  activeRecording = null;
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  if (!uri) throw new Error("Recording URI is null");
  const map = await getMap();
  map[wordId] = uri;
  await saveMap(map);
}

export async function cancelRecording(): Promise<void> {
  if (!activeRecording) return;
  try { await activeRecording.stopAndUnloadAsync(); } catch {}
  activeRecording = null;
  if (Audio) await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
}

export async function playRecording(wordId: string, onDone?: () => void): Promise<void> {
  if (!Audio) throw new Error("NEEDS_NATIVE_BUILD");
  const map = await getMap();
  const uri = map[wordId];
  if (!uri) throw new Error("No recording for this word");
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((s: any) => {
    if (s.isLoaded && s.didJustFinish) { sound.unloadAsync(); onDone?.(); }
  });
}

export async function deleteRecording(wordId: string): Promise<void> {
  const map = await getMap();
  delete map[wordId];
  await saveMap(map);
}
