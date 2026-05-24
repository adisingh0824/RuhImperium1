import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useWishlist } from "@/context/WishlistContext";
import { useCart } from "@/context/CartContext";

type AuthMode = "login" | "signup";

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { user, login, signup, logout, loading } = useAuth();
  const { ids: wishlistIds } = useWishlist();
  const { count: cartCount } = useCart();

  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter email and password.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        if (!name.trim()) {
          Alert.alert("Missing name", "Please enter your name.");
          return;
        }
        await signup(name.trim(), email.trim(), phone.trim(), password);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Account</Text>
        </View>
      </View>
    );
  }

  if (user) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100 }}
      >
        <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Account</Text>
        </View>

        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
              {user.name?.[0]?.toUpperCase() || "U"}
            </Text>
          </View>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
          {user.isAdmin && (
            <View style={[styles.adminBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.adminText, { color: colors.primary }]}>Admin</Text>
            </View>
          )}
        </View>

        <View style={[styles.statsRow, { borderColor: colors.border }]}>
          <View style={styles.stat}>
            <Ionicons name="heart" size={20} color={colors.destructive} />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{wishlistIds.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Wishlist</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Ionicons name="bag-outline" size={20} color={colors.primary} />
            <Text style={[styles.statNum, { color: colors.foreground }]}>{cartCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>In Cart</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PREFERENCES</Text>
          <View style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="location-outline" size={20} color={colors.foreground} />
            <Text style={[styles.menuText, { color: colors.foreground }]}>Delivery Addresses</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </View>
          <View style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={20} color={colors.foreground} />
            <Text style={[styles.menuText, { color: colors.foreground }]}>Notifications</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </View>
        </View>

        <Pressable
          style={[styles.logoutBtn, { borderColor: colors.destructive }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            logout();
          }}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100 }}
    >
      <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Account</Text>
      </View>

      <View style={styles.authContainer}>
        <View style={[styles.authCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.authTitle, { color: colors.foreground }]}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </Text>
          <Text style={[styles.authSub, { color: colors.mutedForeground }]}>
            {mode === "login"
              ? "Sign in to access your orders and wishlist"
              : "Join Ruh Imperium for a curated attar experience"}
          </Text>

          {mode === "signup" && (
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
          )}
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {mode === "signup" && (
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Phone number (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          )}
          <TextInput
            style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.submitBtn, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
              {submitting ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
            </Text>
          </Pressable>

          <Pressable
            style={styles.switchMode}
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
          >
            <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
              {mode === "login" ? "Don't have an account? " : "Already have an account? "}
              <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                {mode === "login" ? "Sign up" : "Sign in"}
              </Text>
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  profileCard: {
    margin: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 6,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold" },
  userName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  userEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  adminBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, marginTop: 4 },
  adminText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    gap: 4,
  },
  statNum: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1 },
  section: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  menuText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
  },
  logoutText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  authContainer: { padding: 16 },
  authCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  authTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  authSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  switchMode: { alignItems: "center", paddingVertical: 4 },
  switchText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
