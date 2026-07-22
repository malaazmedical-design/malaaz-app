import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  SafeAreaView, Dimensions, Animated, Platform, Modal,
  TextInput, Alert, FlatList,
} from "react-native";

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
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { MIZO_CATEGORIES, MizoWord } from "@/constants/mizoWords";
import { MIZO_IMAGES } from "@/constants/mizoImages";
import {
  getProfile, getVoiceOptions, logEvent,
  getCustomWords, addCustomWord, deleteCustomWord,
  sendFamilyNotification, getContacts,
  CustomWord, MizoProfile, MizoContact,
} from "@/lib/mizoStorage";

const { width } = Dimensions.get("window");
const isTablet = width >= 768;

type MizoState = "neutral" | "speaking" | "success" | "alert" | "thinking";

export default function MizoScreen() {
  const [profile, setProfile] = useState<MizoProfile | null>(null);
  const [activeCat, setActiveCat] = useState(MIZO_CATEGORIES[0].id);
  const [lastPhrase, setLastPhrase] = useState("اضغط على أي كلمة...");
  const [mizoState, setMizoState] = useState<MizoState>("neutral");
  const [subWords, setSubWords] = useState<MizoWord[] | null>(null);
  const [voiceOpts, setVoiceOpts] = useState(getVoiceOptions("male"));
  const [customWords, setCustomWords] = useState<CustomWord[]>([]);
  const [contacts, setContacts] = useState<MizoContact[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("⭐");
  const [newPhrase, setNewPhrase] = useState("");

  // SOS countdown
  const [sosModal, setSosModal] = useState(false);
  const [sosCount, setSosCount] = useState(3);
  const sosTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Dwell time press tracking
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animated values
  const mizoScale = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const sosScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const p = await getProfile();
      setProfile(p);
      setVoiceOpts(getVoiceOptions(p.voiceType));
      setCustomWords(await getCustomWords());
      setContacts(await getContacts());
    })();
  }, []);

  const cols = profile?.oneHandedMode ? (isTablet ? 3 : 2) : (isTablet ? 5 : 3);
  const CARD_SIZE = (width - 48) / cols;

  const bounceMizo = () => {
    Animated.sequence([
      Animated.spring(mizoScale, { toValue: 1.12, useNativeDriver: true, speed: 30 }),
      Animated.spring(mizoScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  };

  const flashSuccess = (isEmergency = false) => {
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: isEmergency ? 0.5 : 0.3, duration: 80, useNativeDriver: true }),
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

  const handleWordPress = useCallback((word: MizoWord) => {
    if (word.children && word.children.length > 0) {
      setSubWords(word.children);
      setMizoState("thinking");
    } else {
      setSubWords(null);
      speak(word.phrase, word.id, activeCat);
    }
  }, [speak, activeCat]);

  // ─── Dwell time handlers ───────────────────────────────────────────────────

  const handlePressIn = useCallback((word: MizoWord) => {
    if (!profile || profile.dwellTime === 0) return;
    dwellTimerRef.current = setTimeout(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleWordPress(word);
    }, profile.dwellTime);
  }, [profile, handleWordPress]);

  const handlePressOut = useCallback(() => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  // ─── SOS ──────────────────────────────────────────────────────────────────

  const handleEmergencyPress = () => {
    setSosModal(true);
    setSosCount(3);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    let count = 3;
    sosTimerRef.current = setInterval(() => {
      count -= 1;
      setSosCount(count);
      if (count <= 0) {
        clearInterval(sosTimerRef.current!);
        setSosModal(false);
        fireSOS();
      }
    }, 1000);
  };

  const cancelSOS = () => {
    if (sosTimerRef.current) clearInterval(sosTimerRef.current);
    setSosModal(false);
    setSosCount(3);
  };

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

  const handleNo = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
    speak("لأ", "no_quick", "responses");
  };

  const handleRepeat = () => {
    if (lastPhrase && lastPhrase !== "اضغط على أي كلمة...") {
      speak(lastPhrase);
    }
  };

  const handleAddCustomWord = async () => {
    if (!newLabel.trim() || !newPhrase.trim()) {
      Alert.alert("تنبيه", "اكتب اسم الكلمة والجملة");
      return;
    }
    const word = await addCustomWord({
      label: newLabel.trim(),
      emoji: newEmoji.trim() || "⭐",
      phrase: newPhrase.trim(),
      category_id: activeCat,
    });
    setCustomWords((prev) => [...prev, word]);
    setNewLabel(""); setNewEmoji("⭐"); setNewPhrase("");
    setAddModalVisible(false);
  };

  const handleDeleteCustomWord = (id: string) => {
    Alert.alert("مسح الكلمة", "متأكد؟", [
      { text: "إلغاء", style: "cancel" },
      {
        text: "امسح", style: "destructive",
        onPress: async () => {
          await deleteCustomWord(id);
          setCustomWords((prev) => prev.filter((w) => w.id !== id));
        },
      },
    ]);
  };

  const currentCategory = MIZO_CATEGORIES.find((c) => c.id === activeCat);
  const activeCatCustomWords = customWords
    .filter((w) => w.category_id === activeCat)
    .map((w): MizoWord => ({ id: w.id, label: w.label, emoji: w.emoji, phrase: w.phrase }));
  const displayWords = subWords ?? [...(currentCategory?.words ?? []), ...activeCatCustomWords];

  const mizoImage = MIZO_IMAGES[
    mizoState === "speaking" ? "speaking"
    : mizoState === "success" ? "success"
    : mizoState === "alert"   ? "alert"
    : mizoState === "thinking"? "thinking"
    : "neutral"
  ];

  const flashColor = mizoState === "alert" ? "#CC2200" : "#1C6B3A";

  return (
    <SafeAreaView style={styles.safe}>
      {/* Green/red flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[styles.flashOverlay, { opacity: flashAnim, backgroundColor: flashColor }]}
      />

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <MaterialCommunityIcons name="arrow-right" size={26} color="#C9A84C" />
        </Pressable>
        <Text style={styles.headerTitle}>ميزو</Text>
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

      {/* Mizo mascot + last phrase */}
      <View style={styles.mizoRow}>
        <Animated.View style={{ transform: [{ scale: mizoScale }] }}>
          <Image source={mizoImage} style={styles.mizoImg} resizeMode="contain" />
        </Animated.View>
        <View style={styles.phraseBox}>
          <Pressable onPress={handleRepeat} style={styles.phraseInner}>
            <MaterialCommunityIcons name="volume-high" size={20} color="#C9A84C" />
            <Text style={styles.phraseText} numberOfLines={2}>{lastPhrase}</Text>
          </Pressable>
          <Text style={styles.patientName}>{profile?.patientName || "المريض"}</Text>
        </View>
      </View>

      {/* Yes / No */}
      <View style={styles.yesNoRow}>
        <Pressable style={[styles.yesNoBtn, styles.noBtn]} onPress={handleNo}>
          <Text style={styles.yesNoText}>❌  لأ</Text>
        </Pressable>
        <Pressable style={[styles.yesNoBtn, styles.yesBtn]} onPress={handleYes}>
          <Text style={styles.yesNoText}>✅  ايوه</Text>
        </Pressable>
      </View>

      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catBar}>
        {subWords && (
          <Pressable style={[styles.catTab, styles.catTabBack]} onPress={() => setSubWords(null)}>
            <Text style={styles.catTabText}>↩ رجوع</Text>
          </Pressable>
        )}
        {MIZO_CATEGORIES.map((cat) => {
          const isActive = activeCat === cat.id && !subWords;
          return (
            <Pressable
              key={cat.id}
              style={[styles.catTab, isActive && styles.catTabActive]}
              onPress={() => { setActiveCat(cat.id); setSubWords(null); }}
            >
              <Text style={[styles.catTabText, isActive && styles.catTabTextActive]}>
                {cat.emoji} {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Words grid */}
      <ScrollView contentContainerStyle={[styles.grid, { paddingBottom: 8 }]} showsVerticalScrollIndicator={false}>
        {/* Contact photo cards — shown in عيلة category */}
        {activeCat === "family" && !subWords && contacts.map((c) => (
          <Pressable
            key={c.id}
            style={({ pressed }) => [styles.card, { width: CARD_SIZE, height: CARD_SIZE }, pressed && styles.cardPressed]}
            onPress={profile?.dwellTime === 0 ? () => speak(c.phrase, c.id, "family") : undefined}
            onPressIn={() => {
              if (!profile || profile.dwellTime === 0) return;
              dwellTimerRef.current = setTimeout(() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                speak(c.phrase, c.id, "family");
              }, profile.dwellTime);
            }}
            onPressOut={handlePressOut}
          >
            {c.photo ? (
              <Image source={{ uri: c.photo }} style={styles.contactAvatar} />
            ) : (
              <View style={[styles.contactAvatarPlaceholder, { backgroundColor: c.color }]}>
                <Text style={styles.contactInitial}>{c.name[0]}</Text>
              </View>
            )}
            <Text style={[styles.cardLabel, { marginTop: 2 }]} numberOfLines={2}>{c.name}</Text>
          </Pressable>
        ))}

        {/* Manage contacts shortcut in عيلة */}
        {activeCat === "family" && !subWords && (
          <Pressable
            style={[styles.addCard, { width: CARD_SIZE, height: CARD_SIZE }]}
            onPress={() => router.push("/mizo/contacts")}
          >
            <MaterialCommunityIcons name="account-edit-outline" size={28} color="#C9A84C" />
            <Text style={styles.addCardLabel}>عدّل العيلة</Text>
          </Pressable>
        )}

        {displayWords.map((word) => (
          <Pressable
            key={word.id}
            style={({ pressed }) => [
              styles.card,
              { width: CARD_SIZE, height: CARD_SIZE },
              pressed && styles.cardPressed,
            ]}
            onPress={profile?.dwellTime === 0 ? () => handleWordPress(word) : undefined}
            onPressIn={() => handlePressIn(word)}
            onPressOut={handlePressOut}
            onLongPress={() => word.id.startsWith("custom_") && handleDeleteCustomWord(word.id)}
            delayLongPress={1500}
          >
            <Text style={[styles.cardEmoji, profile?.oneHandedMode && styles.cardEmojiLarge]}>{word.emoji}</Text>
            <Text style={[styles.cardLabel, profile?.oneHandedMode && styles.cardLabelLarge]}>{word.label}</Text>
            {word.children && word.children.length > 0 && (
              <Text style={styles.cardArrow}>›</Text>
            )}
            {word.id.startsWith("custom_") && (
              <View style={styles.customBadge}><Text style={styles.customBadgeText}>✦</Text></View>
            )}
          </Pressable>
        ))}

        {/* Pain shortcut card */}
        {!subWords && activeCat === "health" && (
          <Pressable
            style={[styles.card, styles.painCard, { width: CARD_SIZE, height: CARD_SIZE }]}
            onPress={() => router.push("/mizo/pain")}
          >
            <Text style={styles.cardEmoji}>🗺️</Text>
            <Text style={[styles.cardLabel, { color: "#CC2200" }]}>خريطة الوجع</Text>
          </Pressable>
        )}

        {!subWords && (
          <Pressable
            style={[styles.addCard, { width: CARD_SIZE, height: CARD_SIZE }]}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addCardIcon}>＋</Text>
            <Text style={styles.addCardLabel}>أضف كلمة</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Emergency SOS button */}
      <Pressable style={styles.emergencyBtn} onPress={handleEmergencyPress}>
        <MaterialCommunityIcons name="alert-circle" size={22} color="#fff" />
        <Text style={styles.emergencyText}>🆘  النجدة</Text>
      </Pressable>

      {/* SOS countdown modal */}
      <Modal visible={sosModal} transparent animationType="fade">
        <View style={styles.sosOverlay}>
          <View style={styles.sosBox}>
            <Text style={styles.sosTitle}>🚨 جاري إرسال النجدة</Text>
            <Animated.Text style={styles.sosCount}>{sosCount}</Animated.Text>
            <Text style={styles.sosHint}>بيتبعت بعد {sosCount} ثواني</Text>
            <Pressable style={styles.sosCancelBtn} onPress={cancelSOS}>
              <Text style={styles.sosCancelText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add custom word modal */}
      <Modal visible={addModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>إضافة كلمة جديدة</Text>

            <Text style={styles.modalLabel}>الإيموجي</Text>
            <View style={styles.emojiSelected}>
              <Text style={styles.emojiSelectedText}>{newEmoji}</Text>
            </View>
            <FlatList
              data={EMOJI_LIST}
              keyExtractor={(e) => e}
              numColumns={8}
              scrollEnabled={false}
              style={styles.emojiGrid}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.emojiCell, newEmoji === item && styles.emojiCellActive]}
                  onPress={() => setNewEmoji(item)}
                >
                  <Text style={styles.emojiCellText}>{item}</Text>
                </Pressable>
              )}
            />

            <Text style={styles.modalLabel}>اسم الكلمة</Text>
            <TextInput
              style={styles.modalInput} value={newLabel} onChangeText={setNewLabel}
              placeholder="مثال: عصير" textAlign="right" placeholderTextColor="#9AABAA"
            />

            <Text style={styles.modalLabel}>الجملة الكاملة</Text>
            <TextInput
              style={styles.modalInput} value={newPhrase} onChangeText={setNewPhrase}
              placeholder="مثال: أنا عايز عصير" textAlign="right" placeholderTextColor="#9AABAA"
            />

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

  flashOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 99, pointerEvents: "none",
  },

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
  patientName: {
    fontFamily: "Cairo_400Regular", fontSize: 11, color: "#C9A84C88",
    textAlign: "right", paddingHorizontal: 10, paddingBottom: 6,
  },

  yesNoRow: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  yesNoBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  yesBtn: { backgroundColor: "#1C6B3A" },
  noBtn: { backgroundColor: "#8B1A1A" },
  yesNoText: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#FFFFFF" },

  catBar: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: "row-reverse" },
  catTab: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 22,
    backgroundColor: "#D8E3E2", borderWidth: 1.5, borderColor: "#C0CECA",
  },
  catTabActive: { backgroundColor: "#1C2B2A", borderColor: "#1C2B2A" },
  catTabBack: { backgroundColor: "#C9A84C22", borderWidth: 1.5, borderColor: "#C9A84C" },
  catTabText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#1C2B2A" },
  catTabTextActive: { color: "#C9A84C" },

  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, paddingTop: 8, gap: 8, justifyContent: "flex-end" },
  card: {
    backgroundColor: "#FFFFFF", borderRadius: 16,
    alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 1.5, borderColor: "#E0E8E7",
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  cardPressed: { backgroundColor: "#EDF5F4", transform: [{ scale: 0.95 }] },
  cardEmoji: { fontSize: 34 },
  cardEmojiLarge: { fontSize: 42 },
  cardLabel: { fontFamily: "Cairo_700Bold", fontSize: 13, color: "#1C2B2A", textAlign: "center" },
  cardLabelLarge: { fontSize: 15 },
  cardArrow: { position: "absolute", top: 6, left: 8, fontSize: 18, color: "#C9A84C", fontWeight: "700" },
  customBadge: { position: "absolute", top: 6, right: 8 },
  customBadgeText: { fontSize: 10, color: "#C9A84C" },

  painCard: { borderColor: "#CC220033", backgroundColor: "#FFF5F5" },

  addCard: {
    borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 4,
    borderWidth: 2, borderColor: "#C9A84C55", borderStyle: "dashed", backgroundColor: "#FDFAF3",
  },
  addCardIcon: { fontSize: 28, color: "#C9A84C" },
  addCardLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 12, color: "#C9A84C" },

  contactAvatar: { width: 52, height: 52, borderRadius: 26 },
  contactAvatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  contactInitial: { fontSize: 22, fontFamily: "Cairo_700Bold", color: "#fff" },

  emergencyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#CC2200", marginHorizontal: 12,
    marginBottom: Platform.OS === "ios" ? 8 : 12,
    paddingVertical: 16, borderRadius: 16,
  },
  emergencyText: { fontFamily: "Cairo_700Bold", fontSize: 20, color: "#FFFFFF" },

  // SOS countdown modal
  sosOverlay: { flex: 1, backgroundColor: "#CC220099", alignItems: "center", justifyContent: "center" },
  sosBox: { backgroundColor: "#fff", borderRadius: 24, padding: 32, alignItems: "center", width: 280 },
  sosTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#CC2200", textAlign: "center", marginBottom: 16 },
  sosCount: { fontFamily: "Cairo_700Bold", fontSize: 80, color: "#CC2200", lineHeight: 90 },
  sosHint: { fontFamily: "Cairo_400Regular", fontSize: 14, color: "#7A8A89", textAlign: "center", marginBottom: 24 },
  sosCancelBtn: { backgroundColor: "#1C2B2A", paddingHorizontal: 40, paddingVertical: 14, borderRadius: 14 },
  sosCancelText: { fontFamily: "Cairo_700Bold", fontSize: 16, color: "#C9A84C" },

  // Add word modal
  modalOverlay: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "92%" },
  modalTitle: { fontFamily: "Cairo_700Bold", fontSize: 18, color: "#1C2B2A", textAlign: "right", marginBottom: 14 },
  modalLabel: { fontFamily: "Cairo_600SemiBold", fontSize: 13, color: "#1C2B2A", textAlign: "right", marginBottom: 6 },
  modalInput: {
    backgroundColor: "#F5F7F6", borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 10, fontFamily: "Cairo_400Regular", fontSize: 14,
    color: "#1C2B2A", borderWidth: 1, borderColor: "#E0E8E7", marginBottom: 12,
  },
  emojiSelected: {
    alignSelf: "center", width: 56, height: 56, borderRadius: 14,
    backgroundColor: "#F5F7F6", borderWidth: 2, borderColor: "#C9A84C",
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emojiSelectedText: { fontSize: 32 },
  emojiGrid: { marginBottom: 10 },
  emojiCell: { flex: 1, aspectRatio: 1, alignItems: "center", justifyContent: "center", borderRadius: 8, margin: 2 },
  emojiCellActive: { backgroundColor: "#C9A84C33" },
  emojiCellText: { fontSize: 22 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#E8EDEC" },
  modalCancelText: { fontFamily: "Cairo_600SemiBold", fontSize: 14, color: "#1C2B2A" },
  modalSave: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: "#1C2B2A" },
  modalSaveText: { fontFamily: "Cairo_700Bold", fontSize: 14, color: "#C9A84C" },
});
