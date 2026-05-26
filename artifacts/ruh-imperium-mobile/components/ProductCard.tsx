import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { imageUrl } from "@/lib/api";
import type { Product } from "@/lib/api";

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const colors = useColors();
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();
  const wishlisted = isWishlisted(product.id);

  const handleAddToCart = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addToCart({
      id: product.id,
      name: product.name,
      img: product.img,
      price: product.price,
      size: product.sizes[0] || "Standard",
    });
  };

  const handleWishlist = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(product.id);
  };

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
      ]}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: imageUrl(product.img) }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        {product.badge && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
              {product.badge}
            </Text>
          </View>
        )}
        {discount && (
          <View style={[styles.discountBadge, { backgroundColor: colors.destructive }]}>
            <Text style={styles.discountText}>{discount}% off</Text>
          </View>
        )}
        <Pressable style={styles.wishBtn} onPress={handleWishlist} hitSlop={8}>
          <Ionicons
            name={wishlisted ? "heart" : "heart-outline"}
            size={18}
            color={wishlisted ? colors.destructive : colors.mutedForeground}
          />
        </Pressable>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {product.name}
        </Text>
        {!compact && (
          <Text style={[styles.cat, { color: colors.mutedForeground }]} numberOfLines={1}>
            {product.cat}
          </Text>
        )}
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: colors.primary }]}>
            ₹{product.price.toLocaleString("en-IN")}
          </Text>
          {product.oldPrice && (
            <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
              ₹{product.oldPrice.toLocaleString("en-IN")}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleAddToCart}
        >
          <Ionicons name="bag-add-outline" size={14} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#f0ede6",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  discountBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    color: "#fff",
    fontFamily: "Inter_600SemiBold",
  },
  wishBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 20,
    padding: 5,
  },
  info: {
    padding: 10,
    gap: 3,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  cat: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  price: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  oldPrice: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "line-through",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
