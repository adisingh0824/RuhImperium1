import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { apiPost } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
}

const PRESETS = [
  { label: "Fresh Office", prompt: "fresh and clean for office" },
  { label: "Floral", prompt: "romantic floral tone" },
  { label: "Woody", prompt: "woody earthy long lasting" },
  { label: "Sweet", prompt: "sweet vanilla gourmand" },
  { label: "Gift", prompt: "gift under 2000 rupees" },
];

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  text: "Welcome to the Ruh Imperium scent finder. Tell me what mood, occasion, or note you love, and I'll recommend the perfect attar for you.",
};

export default function ScentScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text: text.trim(),
    };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setLoading(true);
    try {
      const res = await apiPost<{ reply: string; suggestions: string[] }>(
        "/api/ai-scent-chat",
        { message: text.trim() }
      );
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: res.reply || "Here are some suggestions for you:",
        suggestions: res.suggestions,
      };
      setMessages((prev) => [assistantMsg, ...prev]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "I'm having trouble connecting right now. Please try again shortly.",
      };
      setMessages((prev) => [errMsg, ...prev]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Ionicons name="sparkles" size={14} color={colors.primaryForeground} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, alignSelf: "flex-end" }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isUser ? colors.primaryForeground : colors.foreground },
            ]}
          >
            {item.text}
          </Text>
          {item.suggestions && item.suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {item.suggestions.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.suggestionChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => sendMessage(s)}
                >
                  <Ionicons name="leaf-outline" size={12} color={colors.primary} />
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: isWeb ? 67 : insets.top + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.aiDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            AI Scent Finder
          </Text>
        </View>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Describe your mood and find your perfect attar
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.presetScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.presetContent}
      >
        {PRESETS.map((p) => (
          <Pressable
            key={p.label}
            style={[styles.presetChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            onPress={() => sendMessage(p.prompt)}
          >
            <Text style={[styles.presetText, { color: colors.foreground }]}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={[
          styles.messageList,
          { paddingBottom: isWeb ? 0 : insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          loading ? (
            <View style={[styles.msgRow]}>
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Ionicons name="sparkles" size={14} color={colors.primaryForeground} />
              </View>
              <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          ) : null
        }
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: isWeb ? 34 : insets.bottom + 8,
          },
        ]}
      >
        <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            placeholder="Describe your scent preference..."
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={300}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />
          <Pressable
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() ? colors.primary : colors.muted },
            ]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  presetScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  presetContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  msgRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    alignItems: "flex-end",
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 16,
    gap: 8,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  suggestions: {
    gap: 6,
    marginTop: 4,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  inputBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
});
