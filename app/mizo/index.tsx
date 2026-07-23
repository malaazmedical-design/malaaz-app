import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  SafeAreaView, Animated, Platform, Modal,
  TextInput, Alert, FlatList, Vibration, useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJI_LIST = [
  "🍎","🥛","💧","🍞","🍗","🍕","🍦","☕","🧃","🍌","🍊","🍋",
  "💊","🌡️","🏥","😷","🤒","🩺","💉","🩹",
  "😊","😢","😡","😴","😰","❤️","🙏","😃","😔","🥱",
  "🚽","🛁","🛏️","📺","📱","🔊","🚪","💡","🌙","☀️",
  "✅","❌","❓","⚠️","🆘","🔔","👍","👎","🤝","✋",
  "👨","👩","👦","👧","👴","👵","🧑‍⚕️","👮",
];
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MIZO_CATEGORIES, MizoWord } from "@/constants/mizoWords";
import { MIZO_IMAGES } from "@/constants/mizoImages";
import {
  getProfile, getVoiceOptions, logEvent,
  getCustomWords, addCustomWord, deleteCustomWord,
  sendFamilyNotification, sendContactDirectNotification, notifyPrimaryContact,
  getContacts, getWordCustomizations, getSmartSuggestions, getTopWords,
  getQuickPins, toggleQuickPin,
  setWordCustomization, clearWordCustomization,
  CustomWord, MizoProfile, MizoContact, WordCustomization, SmartSuggestion,
} from "@/lib/mizoStorage";

const AVATAR_COLORS = ["#2E7D6B","#1C5C8A","#7B3F8C","#B85C1A","#1A6B4A","#8C3A3A","#5A6B1A","#6B1A5A"];

type MizoState = "neutral" | "speaking" | "success" | "alert" | "thinking";

export default function MizoScreen() {
  const [profile, setProfile] = useState<MizoProfile | null>(null);
  const isNight = (() => { const h = new Date().getHours(); return h >= 22 || h < 7; })();
  const [activeCat, setActiveCat] = useState(() => {
    const h = new Date().getHours();
    return (h >= 22 || h < 7) ? "comfort" : MIZO_CATEGORIES[0].id;
  });
  const [lastPhrase, setLastPhrase] = useState("اضغط على أي كلمة...");
  const [mizoState, setMizoState] = useState<MizoState>("neutral");
  const [subWords, setSubWords] = useState<MizoWord[] | null>(null);
  const [voiceOpts, setVoiceOpts] = useState(getVoiceOptions("male"));
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [contacts, setContacts] = useState<MizoContact[]>([]);
  const [wordCustoms, setWordCustoms] = useState<Record<string, WordCustomization>>({});
  const [smartWords, setSmartWords] = useState<SmartSuggestion[]>([]);
  const [pinnedWords, setPinnedWords] = useState<SmartSuggestion[]>([]);
  const [quickPinIds, setQuickPinIds] = useState<string[]>(["water", "bathroom", "medicine", "pain"]);

  // Add custom word modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("⭐");
  const [newPhrase, setNewPhrase] = useState("");

  // Personalize card modal (long-press on any hardcoded card)
  const [personalizeWord, setPersonalizeWord] = useState<MizoWord | null>(null);
  const [personalizeLabel, setPersonalizeLabel] = useState("");
  const [personalizePhoto, setPersonalizePhoto] = useState<string | null>(null);

  // SOS countdown
  const [sosModal, setSosModal] = useState(false);
  const [sosCount, setSosCount] = useState(3);
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Soft buzzer
  const [buzzerSent, setBuzzerSent] = useState(false);
  const buzzerCooldown = useRef(false);
  const buzzerScale = useRef(new Animated.Value(1)).current;

  const mizoScale = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      setProfile(p);
      setVoiceOpts(getVoiceOptions(p.voiceType));
      setCustomWords(await getCustomWords());
      setContacts(await getContacts());
      setWordCustoms(await getWordCustomizations());
      setSmartWords(await getSmartSuggestions(new Date().getHours()));
      const pins = await getQuickPins();
      setQuickPinIds(pins);
      setPinnedWords(await getTopWords(6, pins));
    })();
  }, []);

  const cols = profile?.oneHandedMode
    ? (isTablet ? 3 : isLandscape ? 3 : 2)
    : (isTablet ? (isLandscape ? 6 : 5) : (isLandscape ? 4 : 3));
  const CARD_SIZE = (width - 48) / cols;

  const bounceMizo = () => {
    Animated.sequence([
      Animated.spring(mizoScale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
      Animated.spring(mizoScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const flashSuccess = (isEmergency = false) => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: isEmergency ? 0.5 : 0.28, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  };

  const speak = useCallback((phrase: string, wordId = "", category = "", isEmergency = false) => {
    Speech.stop();
    setLastPhrase(phrase);
    setMizoState("speaking");
    bounceMizo();
    flashSuccess(isEmergency);
    Haptics.impactAsync(isEmergency ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
    Speech.speak(phrase, {
      ...voiceOpts,
      onDone: () => setMizoState("neutral"),
      onError: () => setMizoState("neutral"),
    });
    logEvent({ word_id: wordId, phrase, category, is_emergency: isEmergency });
    if (profile) {
      sendFamilyNotification(
        profile.patientName || "المريض", phrase, isEmergency,
        profile.quietHoursEnabled, profile.quietHoursStart, profile.quietHoursEnd,
      );
    }
  }, [voiceOpts, profile]);

  const handleWordPress = useCallback((word: MizoWord, customPhrase?: string) => {
    if (word.children && word.children.length > 0) {
      setSubWords(word.children);
      setMizoState("thinking");
    } else {
      setSubWords(null);
      speak(customPhrase ?? word.phrase, word.id, activeCat);
    }
  }, [speak, activeCat]);

  // ─── Dwell ────────────────────────────────────────────────────────────────
  const handlePressIn = useCallback((word: MizoWord, customPhrase?: string) => {
    if (!profile || profile.dwellTime === 0) return;
    dwellTimerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleWordPress(word, customPhrase);
    }, profile.dwellTime);
  }, [profile, handleWordPress]);

  const handlePressOut = useCallback(() => {
    if (dwellTimerRef.current) { clearTimeout(dwellTimerRef.current); dwellTimerRef.current = null; }
  }, []);

  // ─── Personalize card ─────────────────────────────────────────────────────
  const openPersonalize = (word: MizoWord) => {
    setPersonalizeWord(word);
    const existing = wordCustoms[word.id];
    setPersonalizeLabel(existing?.label ?? word.label);
    setPersonalizePhoto(existing?.photo ?? null);
  };

  const pickPersonalizePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الوصول للصور"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 0.25, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPersonalizePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const takePersonalizePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("تنبيه", "محتاج صلاحية الكاميرا"); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.25, base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPersonalizePhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const savePersonalize = async () => {
    if (!personalizeWord) return;
    const custom: WordCustomization = { label: personalizeLabel.trim() || personalizeWord.label, photo: personalizePhoto };
    await setWordCustomization(personalizeWord.id, custom);
    setWordCustoms((prev) => ({ ...prev, [personalizeWord.id]: custom }));
    setPersonalizeWord(null);
  };

  const clearPersonalize = async () => {
    if (!personalizeWord) return;
    await clearWordCustomization(personalizeWord.id);
    setWordCustoms((prev) => { const n = { ...prev }; delete n[personalizeWord.id]; return n; });
    setPersonalizeWord(null);
  };

  // ─── SOS ──────────────────────────────────────────────────────────────────
  const handleEmergencyPress = () => {
    setSosModal(true); setSosCount(3);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    let count = 3;
    sosTimerRef.current = setInterval(() => {
      count -= 1; setSosCount(count);
      if (count <= 0) { clearInterval(sosTimerRef.current!); setSosModal(false); fireSOS(); }
    }, 1000);
  };

  const cancelSOS = () => { if (sosTimerRef.current) clearInterval(sosTimerRef.current); setSosModal(false); setSosCount(3); };

  const fireSOS = () => {
    setMizoState("alert");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    speak("النجدة! أنا محتاج مساعدة فوراً!", "emergency", "emergency", true);
  };

  const handleYes = () => {
    setMizoState("success");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    speak("ايوه", "yes_quick", "responses");
    setTimeout(() => setMizoState("neutral"), 1500);
  };
  const handleNo = () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid); speak("لأ", "no_quick", "responses"); };
  const handleRepeat = () => { if (lastPhrase && lastPhrase !== "اضغط على أي كلمة...") speak(lastPhrase); };

  const handleBuzzer = useCallback(() => {
    if (buzzerCooldown.current) return;
    buzzerCooldown.current = true;
    setBuzzerSent(true);

    // Vibration pattern + haptic for in-room alerting
    Vibration.vibrate([0, 500, 150, 500, 150, 500]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Speak loud in the room — calls for anyone nearby, not the patient themselves
    Speech.stop();
    const name = profile?.patientName || "المريض";
    Speech.speak("لو سمحتم! في حد هنا؟ محتاج مساعدة", { ...voiceOpts });

    // Button pulse animation
    Animated.sequence([
      Animated.spring(buzzerScale, { toValue: 1.06, useNativeDriver: true, speed: 25 }),
      Animated.spring(buzzerScale, { toValue: 1, useNativeDriver: true, speed: 18 }),
    ]).start();

    // Push notification goes only to the designated primary contact
    const phrase = `${name} بينادي عليك — روح شوفه`;
    if (profile) {
      notifyPrimaryContact(name, phrase, profile.quietHoursEnabled, profile.quietHoursStart, profile.quietHoursEnd);
    }
    logEvent({ word_id: "buzzer", phrase, category: "buzzer", is_emergency: false });

    // Reset after 5 seconds
    setTimeout(() => {
      setBuzzerSent(false);
      buzzerCooldown.current = false;
    }, 5000);
  }, [voiceOpts, profile, buzzerScale]);

  const handleAddCustomWord = async () => {
    if (!newLabel.trim() || !newPhrase.trim()) { Alert.alert("تنبيه", "اكتب اسم الكلمة والجملة"); return; }
    const word = await addCustomWord({ label: newLabel.trim(), emoji: newEmoji.trim() || "⭐", phrase: newPhrase.trim(), category_id: activeCat });
    setCustomWords((prev) => [...prev, word]);
    setNewLabel(""); setNewEmoji("⭐"); setNewPhrase(""); setAddModalVisible(false);
  };

  const handleDeleteCustomWord = (id: string) => {
    Alert.alert("مسح الكلمة", "متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      { text: "امسح", style: "destructive", onPress: async () => { await deleteCustomWord(id); setCustomWords((prev) => prev.filter((w) => w.id !== id)); } },
    ]);
  };

  const currentCategory = MIZO_CATEGORIES.find((c) => c.id === activeCat);
  const activeCatCustomWords = customWords.filter((w) => w.category_id === activeCat)
    .map((w): MizoWord => ({ id: w.id, label: w.label, emoji: w.emoji, phrase: w.phrase }));
  const displayWords = subWords ?? [...(currentCategory?.words ?? []), ...activeCatCustomWords];

  const mizoImage = MIZO_IMAGES[
    mizoState === "speaking" ? "speaking" : mizoState === "success" ? "success"
    : mizoState === "alert" ? "alert" : mizoState === "thinking" ? "thinking" : "neutral"
  ];
  const flashColor = mizoState === "alert" ? "#CC2200" : "#1C6B3A";

  // helper: get display info for a word (applying customization)
  const findWord = (id: string, words?: MizoWord[]): MizoWord | null => {
    const list = words ?? MIZO_CATEGORIES.flatMap((c) => c.words);
    for (const w of list) {
      if (w.id === id) return w;
      if (w.children?.length) { const f = findWord(id, w.children); if (f) return f; }
    }
    return null;
  };

  const getWordDisplay = (word: MizoWord) => {
    const custom = wordCustoms[word.id];
    return { label: custom?.label ?? word.label, photo: custom?.photo ?? null };
  };

  return (
    <SafeAreaView style={[styles.safe, isNight && { backgroundColor: "#0D1A19" }]}>
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashAnim, backgroundColor: flashColor }]} />

      {/* Header */}
      <View style={[styles.header, isNight && { backgroundColor: "#071210" }]}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={[styles.headerTitle, isNight && { color: "#B89038" }]}>
          {isNight ? "ميزو 🌙" : "ميزو"}
        </Text>
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push("/mizo/family")} style={styles.headerBtn}>
            <MaterialCommunityIcons name="bell-outline" size={22} color="#7A8A89" />
          </Pressable>
          <Pressable onPress={() => router.push("/mizo/history")} style={styles.headerBtn}>
            <MaterialCommunityIcons name="history" size={22} color="#7A8A89" />
          </Pressable>
          <Pressable onPress={() => router.push("/mizo/settings")} style={styles.headerBtn}>
            <MaterialCommunityIcons name="cog-outline" size={22} color="#7A8A89" />
          </Pressable>
        </View>
      </View>

      {/* Mizo mascot + phrase */}
      <View style={[styles.mizoRow, isNight && { backgroundColor: "#0A1614" }]}>
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Image source={mizoImage} style={[styles.mizoImg, isTablet && { width: 110, height: 110 }]} resizeMode="contain" />
        </Animated.View>
        <View style={[styles.phraseBox, isNight && { backgroundColor: "#0A1614" }]}>
          <Pressable onPress={handleRepeat} style={styles.phraseInner}>
            <MaterialCommunityIcons name="volume-high" size={20} color="#C9A84C" />
            <Text style={styles.phraseText} numberOfLines={2}>{lastPhrase}</Text>
          </Pressable>
          <Text style={styles.patientName}>{profile?.patientName || "المريض"}</Text>
        </View>
      </View>

      {/* Yes / No */}
      <View style={[styles.yesNoRow, isNight && { backgroundColor: "#0D1A19" }]}>
        <Pressable style={[styles.yesNoBtn, styles.noBtn]} onPress={handleNo}>
          <Text style={styles.yesNoText}>❌  لأ</Text>
        </Pressable>
        <Pressable style={[styles.yesNoBtn, styles.yesBtn]} onPress={handleYes}>
          <Text style={styles.yesNoText}>✅  ايوه</Text>
        </Pressable>
      </View>

      {/* Quick Access Bar — dynamic pins */}
      <View style={[styles.quickBar, isNight && { backgroundColor: "#0A1412", borderBottomColor: "#1A2E2C" }]}>
        {quickPinIds.map((pinId) => {
          const w = findWord(pinId);
          if (!w) return null;
          return (
            <Pressable
              key={pinId}
              style={({ pressed }) => [styles.quickBtn, pressed && styles.quickBtnPressed]}
              onPress={() => speak(w.phrase, w.id, "quick")}
              onLongPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const { pins } = await toggleQuickPin(pinId);
                setQuickPinIds(pins);
                Speech.speak("تم الإزالة", { language: "ar-EG" });
              }}
              delayLongPress={800}
            >
              <Text style={styles.quickEmoji}>{w.emoji}</Text>
              <Text style={styles.quickLabel} numberOfLines={1}>{w.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Soft Buzzer */}
      <View style={[styles.buzzerWrap, isNight && { backgroundColor: "#0D1A19" }]}>
        <Animated.View style={{ transform: [{ scale: buzzerScale }], flex: 1, alignSelf: "stretch" }}>
          <Pressable
            style={[styles.buzzerBtn, buzzerSent && styles.buzzerBtnSent]}
            onPress={handleBuzzer}
            disabled={buzzerCooldown.current}
          >
            <MaterialCommunityIcons
              name={buzzerSent ? "bell-ring" : "bell-outline"}
              size={22}
              color={buzzerSent ? "#FFFFFF" : "#C9A84C"}
            />
            <Text style={[styles.buzzerText, buzzerSent && styles.buzzerTextSent]}>
              {buzzerSent ? "✓  تم إرسال النداء" : "نادوا حد يجيلي"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Category tabs */}
      <View style={[styles.catBarWrap, isNight && { backgroundColor: "#0D1A19" }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar}>
        {subWords && (
          <Pressable style={[styles.catTab, styles.catTabBack]} onPress={() => setSubWords(null)}>
            <Text style={styles.catTabText}>↩</Text>
            <Text style={styles.catTabText}>رجوع</Text>
          </Pressable>
        )}
        {[...MIZO_CATEGORIES].reverse().map((cat) => {
          const isActive = activeCat === cat.id && !subWords;
          return (
            <Pressable key={cat.id}
              style={[
                styles.catTab,
                isActive && styles.catTabActive,
                isNight && !isActive && { backgroundColor: "#1A2E2E", borderColor: "#2A4040" },
                isNight && isActive && { backgroundColor: "#C9A84C", borderColor: "#C9A84C" },
              ]}
              onPress={() => { setActiveCat(cat.id); setSubWords(null); }}>
              <Text style={styles.catTabEmoji}>{cat.emoji}</Text>
              <Text style={[
                styles.catTabText,
                isActive && styles.catTabTextActive,
                isNight && !isActive && { color: "#8ABAB7" },
                isNight && isActive && { color: "#0D1A19" },
              ]}>{cat.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>


      {/* Words grid */}
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}
        style={isNight ? { flex: 1, backgroundColor: "#0D1A19" } : { flex: 1 }}>
        {/* Auto-pinned: top words by all-time usage */}
        {pinnedWords.length >= 2 && !subWords && activeCat !== "family" && (
          <View style={styles.pinnedBlock}>
            <View style={styles.pinnedHeader}>
              <MaterialCommunityIcons name="pin" size={13} color="#C9A84C" />
              <Text style={styles.pinnedTitle}>الأكثر استخداماً</Text>
            </View>
            <View style={styles.pinnedRow}>
              {pinnedWords.map((sw) => {
                const word = findWord(sw.word_id);
                return (
                  <Pressable
                    key={`pin_${sw.word_id}`}
                    style={({ pressed }) => [styles.card, styles.cardPinned, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed]}
                    onPress={() => speak(sw.phrase, sw.word_id, "pinned")}
                    onPressIn={() => {
                      if (profile && profile.dwellTime > 0) {
                        dwellTimerRef.current = setTimeout(() => {
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          speak(sw.phrase, sw.word_id, "pinned");
                        }, profile.dwellTime);
                      }
                    }}
                    onPressOut={handlePressOut}
                  >
                    <Text style={styles.cardEmoji}>{word?.emoji ?? "💬"}</Text>
                    <Text style={styles.cardLabel} numberOfLines={2}>{word?.label ?? sw.phrase.slice(0, 12)}</Text>
                    <View style={styles.pinBadge}>
                      <MaterialCommunityIcons name="pin" size={9} color="#C9A84C" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.pinnedSep} />
          </View>
        )}

        {/* Contacts in family category */}
        {activeCat === "family" && !subWords && contacts.map((c, idx) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.card, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed, !!c.push_token && styles.cardWithNotify]}
            onPress={() => {
              if (!profile || profile.dwellTime === 0) {
                speak(c.phrase, c.id, "family");
                if (c.push_token) sendContactDirectNotification(c, profile?.patientName ?? "المريض");
              }
            }}
            onPressIn={() => handlePressIn({ id: c.id, label: c.name, emoji: "👤", phrase: c.phrase })}
            onPressOut={handlePressOut}
            onLongPress={() => router.push("/mizo/contacts")}
            delayLongPress={1500}
          >
            {c.photo ? (
              <Image source={{ uri: c.photo }} style={styles.contactAvatar} />
            ) : (
              <View style={[styles.contactAvatarPlaceholder, { backgroundColor: c.color }]}>
                <Text style={styles.contactInitial}>{c.name[0]}</Text>
              </View>
            )}
            <Text style={styles.cardLabel} numberOfLines={2}>{c.name}</Text>
            <Text style={styles.cardRelation}>{c.relation}</Text>
            {c.push_token && (
              <View style={styles.notifyDot}>
                <MaterialCommunityIcons name="bell-outline" size={10} color="#1C6B3A" />
              </View>
            )}
          </Pressable>
        ))}

        {/* Main word cards */}
        {displayWords.map((word, idx) => {
          const { label: displayLabel, photo: displayPhoto } = getWordDisplay(word);
          const isFamily = activeCat === "family" && !subWords;
          const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
          const isCustomized = !!wordCustoms[word.id];
          const isPinned = quickPinIds.includes(word.id);

          return (
            <Pressable
              key={word.id}
              style={({ pressed }) => [styles.card, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed, isCustomized && styles.cardCustomized, isPinned && styles.cardQuickPinned]}
              onPress={() => { if (!profile || profile.dwellTime === 0) handleWordPress(word); }}
              onPressIn={() => handlePressIn(word)}
              onPressOut={handlePressOut}
              onLongPress={async () => {
                if (word.id.startsWith("custom_")) {
                  handleDeleteCustomWord(word.id);
                } else if (!isFamily) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const { pinned, pins } = await toggleQuickPin(word.id);
                  setQuickPinIds(pins);
                  Speech.speak(pinned ? "تم التثبيت" : "تم الإزالة", { language: "ar-EG" });
                }
              }}
              delayLongPress={800}
            >
              {/* Show photo if customized and has photo, otherwise emoji */}
              {isFamily && displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.contactAvatar} />
              ) : isFamily && isCustomized ? (
                <View style={[styles.contactAvatarPlaceholder, { backgroundColor: avatarColor }]}>
                  <Text style={styles.contactInitial}>{displayLabel[0]}</Text>
                </View>
              ) : (
                <Text style={[styles.cardEmoji, profile?.oneHandedMode && styles.cardEmojiLarge]}>{word.emoji}</Text>
              )}
              <Text style={[styles.cardLabel, profile?.oneHandedMode && styles.cardLabelLarge, isCustomized && styles.cardLabelCustom]} numberOfLines={2}>
                {displayLabel}
              </Text>
              {word.children && word.children.length > 0 && <Text style={styles.cardArrow}>›</Text>}
              {word.id.startsWith("custom_") && <View style={styles.customBadge}><Text style={styles.customBadgeText}>✦</Text></View>}
              {isPinned && !isFamily && (
                <View style={styles.quickPinBadge}>
                  <MaterialCommunityIcons name="pin" size={9} color="#C9A84C" />
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Pain shortcut in health */}
        {!subWords && activeCat === "health" && (
          <Pressable style={[styles.card, styles.painCard, { width: CARD_SIZE, height: CARD_SIZE }]} onPress={() => router.push("/mizo/pain")}>
            <Text style={styles.cardEmoji}>🗺️</Text>
            <Text style={[styles.cardLabel, { color: "#CC2200" }]}>خريطة الوجع</Text>
          </Pressable>
        )}

        {/* Add custom word */}
        {!subWords && (
          <Pressable style={[styles.addCard, { width: CARD_SIZE, height: CARD_SIZE }]} onPress={() => setAddModalVisible(true)}>
            <Text style={styles.addCardIcon}>＋</Text>
            <Text style={styles.addCardLabel}>أضف كلمة</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Emergency */}
      <Pressable style={[styles.emergencyBtn, { marginBottom: Math.max(insets.bottom, 8) + 4 }]} onPress={handleEmergencyPress}>
        <MaterialCommunityIcons name="alert-circle" size={22} color="#fff" />
        <Text style={styles.emergencyText}>🆘  النجدة</Text>
      </Pressable>

      {/* SOS countdown */}
      <Modal visible={sosModal} transparent animationType="fade">
        <View style={styles.sosOverlay}>
          <View style={styles.sosBox}>
            <Text style={styles.sosTitle}>🚨 جاري إرسال النجدة</Text>
            <Text style={styles.sosCount}>{sosCount}</Text>
            <Text style={styles.sosHint}>بيتبعت بعد {sosCount} ثواني</Text>
            <Pressable style={styles.sosCancelBtn} onPress={cancelSOS}>
              <Text style={styles.sosCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Personalize card modal */}
      <Modal visible={!!personalizeWord} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>تخصيص بطاقة "{personalizeWord?.label}"</Text>

            {/* Photo */}
            <View style={styles.personalizePhotoRow}>
              {personalizePhoto ? (
                <Image source={{ uri: personalizePhoto }} style={styles.personalizePrev} />
              ) : (
                <View style={styles.personalizePlaceholder}>
                  <Text style={{ fontSize: 36 }}>{personalizeWord?.emoji}</Text>
                </View>
              )}
              <View style={styles.personalizePhotoActions}>
                <Pressable style={styles.personalizePhotoBtn} onPress={pickPersonalizePhoto}>
                  <MaterialCommunityIcons name="image-outline" size={16} color="#1C2B2A" />
                  <Text style={styles.personalizeBtnText}>من الاستوديو</Text>
                </Pressable>
                <Pressable style={styles.personalizePhotoBtn} onPress={takePersonalizePhoto}>
                  <MaterialCommunityIcons name="camera-outline" size={16} color="#1C2B2A" />
                  <Text style={styles.personalizeBtnText}>صوّر دلوقت</Text>
                </Pressable>
                {personalizePhoto && (
                  <Pressable style={[styles.personalizePhotoBtn, { borderColor: "#CC220033" }]} onPress={() => setPersonalizePhoto(null)}>
                    <MaterialCommunityIcons name="delete-outline" size={16} color="#CC2200" />
                    <Text style={[styles.personalizeBtnText, { color: "#CC2200" }]}>مسح الصورة</Text>
                  </Pressable>
                )}
              </View>
            </View>

            <Text style={styles.modalLabel}>الاسم على البطاقة</Text>
            <TextInput
              style={styles.modalInput} value={personalizeLabel} onChangeText={setPersonalizeLabel}
              placeholder={personalizeWord?.label} placeholderTextColor="#9AABAA" textAlign="right"
            />

            <View style={styles.modalActions}>
              {wordCustoms[personalizeWord?.id ?? ""] && (
                <Pressable style={styles.modalDanger} onPress={clearPersonalize}>
                  <Text style={styles.modalDangerText}>مسح التخصيص</Text>
                </Pressable>
              )}
              <Pressable style={styles.modalCancel} onPress={() => setPersonalizeWord(null)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={savePersonalize}>
                <Text style={styles.modalSaveText}>احفظ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add word modal */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>إضافة كلمة جديدة</Text>
            <Text style={styles.modalLabel}>الإيموجي</Text>
            <View style={styles.emojiSelected}><Text style={styles.emojiSelectedText}>{newEmoji}</Text></View>
            <FlatList
              data={EMOJI_LIST} keyExtractor={(e) => e} numColumns={8} scrollEnabled={false} style={styles.emojiGrid}
              renderItem={({ item }) => (
                <Pressable style={[styles.emojiCell, newEmoji === item && styles.emojiCellActive]} onPress={() => setNewEmoji(item)}>
                  <Text style={styles.emojiCellText}>{item}</Text>
                </Pressable>
              )}
            />
            <Text style={styles.modalLabel}>اسم الكلمة</Text>
            <TextInput style={styles.modalInput} value={newLabel} onChangeText={setNewLabel} placeholder="مثال: عصير" textAlign="right" placeholderTextColor="#9AABAA" />
            <Text style={styles.modalLabel}>الجملة الكاملة</Text>
            <TextInput style={styles.modalInput} value={newPhrase} onChangeText={setNewPhrase} placeholder="مثال: أنا عايز عصير" textAlign="right" placeholderTextColor="#9AABAA" />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setAddModalVisible(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable style={styles.modalSave} onPress={handleAddCustomWord}>
                <Text style={styles.modalSaveText}>أضف</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F7F6" },
  flashOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, pointerEvents: "none" },

  header: {
    flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1C2B2A",
  },
  headerTitle: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#C9A84C" },
  headerBtn: { padding: 4 },
  headerActions: { flexDirection: "row-reverse", gap: 8 },

  mizoRow: {
    flexDirection: "row-reverse", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#1C2B2A", gap: 12,
  },
  mizoImg: { width: 80, height: 80 },
  phraseBox: { flex: 1, backgroundColor: "#253D3B", borderRadius: 14, padding: 2 },
  phraseInner: { flexDirection: "row-reverse", alignItems: "center", gap: 8, padding: 10 },
  phraseText: { fontFamily: "Cairo_600SemiBold", fontSize: 16, color: "#FFFFFF", textAlign: "right", flex: 1 },
  patientName: { fontFamily: "Cairo_400Regular", fontSize: 11, color: "#C9A84C88", textAlign: "right", paddingHorizontal: 10, paddingBottom: 6 },

  yesNoRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 4 },
  yesNoBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  yesBtn: { backgroundColor: "#1C6B3A" },
  noBtn: { backgroundColor: "#8B1A1A" },
  yesNoText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#FFFFFF" },

  // ── Quick Bar ──────────────────────────────────────────────────────────────
  quickBar: {
    flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 3,
    backgroundColor: "#EEF3F2", borderBottomWidth: 1, borderBottomColor: "#D8E3E2",
  },
  quickBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
    backgroundColor: "#FFFFFF", borderRadius: 12, paddingVertical: 5,
    borderWidth: 1.5, borderColor: "#D8E3E2",
    elevation: 1, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
  },
  quickBtnPressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  quickEmoji: { fontSize: 17 },
  quickLabel: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A" },

  cardQuickPinned: { borderColor: "#C9A84C88", backgroundColor: "#FFFDF0" },
  quickPinBadge: { position: "absolute", top: 4, left: 4 },

  // ── Soft Buzzer ─────────────────────────────────────────────────────────────
  buzzerWrap: { paddingHorizontal: 12, paddingVertical: 2, flexDirection: "row" },
  buzzerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FFFDF5", borderRadius: 14, paddingVertical: 9,
    borderWidth: 2, borderColor: "#C9A84C",
    elevation: 2, shadowColor: "#C9A84C", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  buzzerBtnSent: { backgroundColor: "#1C6B3A", borderColor: "#1C6B3A" },
  buzzerText: { fontFamily: "Cairo_700Bold", fontSize: 15, color: "#7A4A00" },
  buzzerTextSent: { color: "#FFFFFF" },

  // ── Tabs ────────────────────────────────────────────────────────────────────
  // ── Smart Suggestions Bar ──────────────────────────────────────────────────
  smartBar: {
    backgroundColor: "#EEF3FF", borderBottomWidth: 1, borderBottomColor: "#D0DAF5",
    paddingTop: 4, paddingBottom: 3,
  },
  smartBarTitle: {
    fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#4A6BA8",
    textAlign: "right", paddingHorizontal: 14, marginBottom: 3,
  },
  smartBarScroll: { paddingHorizontal: 12, gap: 8, alignItems: "center" },
  smartChip: {
    alignItems: "center", justifyContent: "center", gap: 3,
    backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 4, paddingHorizontal: 11,
    borderWidth: 1.5, borderColor: "#C0D0F0",
    elevation: 1, shadowColor: "#4A6BA8", shadowOpacity: 0.10, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
    minWidth: 62,
  },
  smartChipPressed: { opacity: 0.75, transform: [{ scale: 0.94 }] },
  smartChipEmoji: { fontSize: 26 },
  smartChipLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 11, color: "#1C2B2A", textAlign: "center" },

  catBarWrap: { minHeight: 38 },
  catBar: { paddingHorizontal: 12, paddingVertical: 2, gap: 6 },
  catTabEmoji: { fontSize: 13 },
  catTab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14,
    backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#C9D6D4",
  },
  catTabActive: { backgroundColor: "#1C2B2A", borderColor: "#1C2B2A" },
  catTabBack: { backgroundColor: "#C9A84C22", borderWidth: 1.5, borderColor: "#C9A84C" },
  catTabText: { fontFamily: "Cairo_700Bold", fontSize: 12, color: "#1C2B2A" },
  catTabTextActive: { color: "#C9A84C" },

  grid: { flexDirection: "row-reverse", flexWrap: "wrap", paddingHorizontal: 12, paddingTop: 2, paddingBottom: 8, gap: 8, justifyContent: "flex-start" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { backgroundColor: "#EDF5F4", transform: [{ scale: 0.95 }] },
  cardPinned: { borderColor: "#C9A84C55", backgroundColor: "#FDFAF3" },

  // ── Auto-Pin ────────────────────────────────────────────────────────────────
  pinnedBlock: { width: "100%", marginBottom: 2 },
  pinnedHeader: {
    flexDirection: "row-reverse", alignItems: "center",
    gap: 5, paddingBottom: 4,
  },
  pinnedRow: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" },
  pinnedTitle: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },
  pinBadge: { position: "absolute", top: 4, right: 4 },
  pinnedSep: { width: "100%", height: 1, backgroundColor: "#E0E8E7", marginTop: 8, marginBottom: 2 },
  cardCustomized: { borderColor: "#C9A84C55", backgroundColor: "#FDFAF3" },
  cardEmoji: { fontSize: 34 },
  cardEmojiLarge: { fontSize: 42 },
  cardLabel: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "center", paddingHorizontal: 4 },
  cardLabelLarge: { fontSize: 15 },
  cardLabelCustom: { color: "#1C5C3A" },
  cardRelation: { fontFamily: "Cairo_400Regular", fontSize: 10, color: "#7A8A89" },
  cardArrow: { position: "absolute", top: 6, left: 8, fontSize: 18, color: "#C9A84C", fontWeight: "700" },
  customBadge: { position: "absolute", top: 6, right: 8 },
  customBadgeText: { fontSize: 10, color: "#C9A84C" },
  editHint: { position: "absolute", bottom: 6, left: 8 },

  contactAvatar: { width: 52, height: 52, borderRadius: 26 },
  contactAvatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  contactInitial: { fontSize: 22, fontFamily: "Cairo_700Bold", color: "#fff" },
  cardWithNotify: { borderColor: "#1C6B3A44" },
  notifyDot: { position: "absolute", top: 6, right: 8, backgroundColor: "#E8F5EF", borderRadius: 8, padding: 2 },

  painCard: { borderColor: "#CC220033", backgroundColor: "#FFF5F5" },
  addCard: { borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 2, borderColor: "#C9A84C55", borderStyle: "dashed", backgroundColor: "#FDFAF3" },
  addCardIcon: { fontSize: 28, color: "#C9A84C" },
  addCardLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },

  emergencyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#CC2200", marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 8 : 12, paddingVertical: 16, borderRadius: 16,
  },
  emergencyText: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#FFFFFF" },

  sosOverlay: { flex: 1, backgroundColor: "#CC220099", alignItems: "center", justifyContent: "center" },
  sosBox: { backgroundColor: "#fff", borderRadius: 24, padding: 32, alignItems: "center", width: "85%", maxWidth: 380, alignSelf: "center" },
  sosTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#CC2200", textAlign: "center", marginBottom: 16 },
  sosCount: { fontFamily: "Cairo_700Bold", fontSize: 80, color: "#CC2200", lineHeight: 90 },
  sosHint: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#7A8A89", textAlign: "center", marginBottom: 24 },
  sosCancelBtn: { backgroundColor: "#1C2B2A", paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14 },
  sosCancelText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#C9A84C" },

  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 17, color: "#1C2B2A", textAlign: "right", marginBottom: 14 },
  modalLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  modalInput: { backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontFamily: "Cairo_400Regular", fontSize: 14, color: "#1C2B2A", borderWidth: 1, borderColor: "#E0E8E7", marginBottom: 12 },
  modalActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#1C2B2A" },
  modalSaveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },
  modalDanger: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#CC220011", borderWidth: 1, borderColor: "#CC220033" },
  modalDangerText: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#CC2200" },

  personalizePhotoRow: { flexDirection: "row-reverse", gap: 12, alignItems: "flex-start", marginBottom: 14 },
  personalizePrev: { width: 76, height: 76, borderRadius: 38 },
  personalizePlaceholder: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#E8EDEC", alignItems: "center", justifyContent: "center" },
  personalizePhotoActions: { flex: 1, gap: 8 },
  personalizePhotoBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, backgroundColor: "#F5F7F6", borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#E0E8E7" },
  personalizeBtnText: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#1C2B2A" },

  emojiSelected: { alignSelf: "center", width: 56, height: 56, borderRadius: 14, backgroundColor: "#F5F7F6", borderWidth: 2, borderColor: "#C9A84C", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  emojiSelectedText: { fontSize: 32 },
  emojiGrid: { marginBottom: 10 },
  emojiCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8, margin: 2 },
  emojiCellActive: { backgroundColor: "#C9A84C33" },
  emojiCellText: { fontSize: 22 },
});
