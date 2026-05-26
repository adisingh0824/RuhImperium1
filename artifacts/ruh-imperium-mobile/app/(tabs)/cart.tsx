import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { apiPost, imageUrl } from "@/lib/api";
import type { CartItem } from "@/lib/api";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { items, removeFromCart, updateQty, clearCart, total } = useCart();
  const { token } = useAuth();
  const [placing, setPlacing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const handleCOD = async () => {
    if (!name.trim() || !phone.trim() || !address.trim()) {
      Alert.alert("Missing details", "Please fill in your name, phone, and address.");
      return;
    }
    setPlacing(true);
    try {
      await apiPost("/api/orders/cod", {
        name,
        phone,
        address,
        items: items.map((i) => ({ id: i.id, qty: i.qty, size: i.size })),
        total,
      }, token ?? undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearCart();
      Alert.alert("Order Placed!", "Your COD order has been placed successfully. You'll receive a confirmation shortly.");
    } catch (e: unknown) {
      Alert.alert("Error", (e as Error).message || "Could not place order. Try again.");
    } finally {
      setPlacing(false);
    }
  };

  const renderItem = ({ item }: { item: CartItem }) => (
    <View style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Image
        source={{ uri: imageUrl(item.img) }}
        style={styles.itemImage}
        contentFit="cover"
      />
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, { color: colors.foreground }]} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.itemSize, { color: colors.mutedForeground }]}>
          {item.size}
        </Text>
        <Text style={[styles.itemPrice, { color: colors.primary }]}>
          ₹{(item.price * item.qty).toLocaleString("en-IN")}
        </Text>
      </View>
      <View style={styles.qtyControls}>
        <Pressable
          style={[styles.qtyBtn, { borderColor: colors.border }]}
          onPress={() => updateQty(item.id, item.size, item.qty - 1)}
        >
          <Ionicons name="remove" size={16} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.qty}</Text>
        <Pressable
          style={[styles.qtyBtn, { borderColor: colors.border }]}
          onPress={() => updateQty(item.id, item.size, item.qty + 1)}
        >
          <Ionicons name="add" size={16} color={colors.foreground} />
        </Pressable>
        <Pressable
          style={styles.removeBtn}
          onPress={() => removeFromCart(item.id, item.size)}
        >
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
        </Pressable>
      </View>
    </View>
  );

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Cart</Text>
        </View>
        <View style={styles.empty}>
          <Ionicons name="bag-outline" size={64} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your cart is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Browse our collection and add your favourite attars
          </Text>
          <Pressable
            style={[styles.shopBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/")}
          >
            <Text style={[styles.shopBtnText, { color: colors.primaryForeground }]}>
              Browse Products
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 67 : insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Cart ({items.length})
        </Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.id}-${item.size}`}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: isWeb ? 34 + 84 : insets.bottom + 320 },
        ]}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <View style={[styles.checkoutSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Delivery Details
            </Text>
            <TextInput
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Full name"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
              placeholder="Phone number"
              placeholderTextColor={colors.mutedForeground}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              style={[styles.textInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, minHeight: 70 }]}
              placeholder="Full delivery address"
              placeholderTextColor={colors.mutedForeground}
              value={address}
              onChangeText={setAddress}
              multiline
            />
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>
                ₹{total.toLocaleString("en-IN")}
              </Text>
            </View>
            <Pressable
              style={[styles.codBtn, { backgroundColor: colors.primary }, placing && { opacity: 0.7 }]}
              onPress={handleCOD}
              disabled={placing}
            >
              <Ionicons name="cash-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.codBtnText, { color: colors.primaryForeground }]}>
                {placing ? "Placing Order..." : "Place Order (COD)"}
              </Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
  },
  list: { padding: 16, gap: 12 },
  cartItem: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#f0ede6",
  },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemSize: { fontSize: 11, fontFamily: "Inter_400Regular" },
  itemPrice: { fontSize: 14, fontFamily: "Inter_700Bold" },
  qtyControls: {
    alignItems: "center",
    gap: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  removeBtn: { padding: 4 },
  checkoutSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 4 },
  textInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  totalValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  codBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  codBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  shopBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  shopBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
