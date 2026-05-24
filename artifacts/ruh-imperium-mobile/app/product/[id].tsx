import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { apiGet, imageUrl } from "@/lib/api";
import type { Product } from "@/lib/api";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { addToCart } = useCart();
  const { toggle, isWishlisted } = useWishlist();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    staleTime: 5 * 60 * 1000,
  });

  const product = products.find((p) => p.id === Number(id));
  const wishlisted = product ? isWishlisted(product.id) : false;
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const size = selectedSize ?? product?.sizes[0] ?? "Standard";

  const handleAddToCart = () => {
    if (!product) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addToCart({
      id: product.id,
      name: product.name,
      img: product.img,
      price: product.price,
      size,
    });
    router.back();
  };

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: isWeb ? 67 : insets.top + 12 }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.notFound}>
          <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>
            Product not found
          </Text>
        </View>
      </View>
    );
  }

  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
      : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100 }}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl(product.img) }}
            style={styles.image}
            contentFit="cover"
          />
          <View style={[styles.topBar, { paddingTop: isWeb ? 67 : insets.top + 12 }]}>
            <Pressable
              onPress={() => router.back()}
              style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.85)" }]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(product.id); }}
              style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.85)" }]}
            >
              <Ionicons
                name={wishlisted ? "heart" : "heart-outline"}
                size={22}
                color={wishlisted ? colors.destructive : colors.foreground}
              />
            </Pressable>
          </View>
          {product.badge && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                {product.badge}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.details}>
          <View style={styles.titleRow}>
            <View style={styles.titleBlock}>
              <Text style={[styles.productName, { color: colors.foreground }]}>
                {product.name}
              </Text>
              <Text style={[styles.catText, { color: colors.mutedForeground }]}>
                {product.cat} · {product.notes}
              </Text>
            </View>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, { color: colors.primary }]}>
              ₹{product.price.toLocaleString("en-IN")}
            </Text>
            {product.oldPrice && (
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                ₹{product.oldPrice.toLocaleString("en-IN")}
              </Text>
            )}
            {discount && (
              <View style={[styles.discountTag, { backgroundColor: colors.destructive }]}>
                <Text style={styles.discountText}>{discount}% off</Text>
              </View>
            )}
          </View>

          <View style={[styles.ratingRow]}>
            <Ionicons name="star" size={14} color={colors.gold} />
            <Text style={[styles.ratingText, { color: colors.foreground }]}>
              {product.stars}
            </Text>
            <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>
              ({product.reviews} reviews)
            </Text>
            {product.bestseller && (
              <View style={[styles.bestsellerTag, { backgroundColor: colors.goldPale ?? colors.secondary }]}>
                <Text style={[styles.bestsellerText, { color: colors.primary }]}>
                  Bestseller
                </Text>
              </View>
            )}
          </View>

          {product.sizes.length > 1 && (
            <View style={styles.sizeSection}>
              <Text style={[styles.sizeLabel, { color: colors.foreground }]}>Size</Text>
              <View style={styles.sizeRow}>
                {product.sizes.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.sizeChip,
                      { borderColor: colors.border },
                      size === s && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setSelectedSize(s)}
                  >
                    <Text
                      style={[
                        styles.sizeChipText,
                        { color: size === s ? colors.primaryForeground : colors.foreground },
                      ]}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <Text style={[styles.descTitle, { color: colors.foreground }]}>About</Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>
            {product.desc}
          </Text>

          {product.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {product.tags.map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.tagText, { color: colors.foreground }]}>{tag}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: isWeb ? 34 : insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={handleAddToCart}
        >
          <Ionicons name="bag-add-outline" size={20} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
            Add to Cart · ₹{product.price.toLocaleString("en-IN")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  imageContainer: { width: "100%", aspectRatio: 1, position: "relative", backgroundColor: "#f0ede6" },
  image: { width: "100%", height: "100%" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  details: { padding: 20, gap: 12 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  titleBlock: { flex: 1, gap: 4 },
  productName: { fontSize: 24, fontFamily: "Inter_700Bold", lineHeight: 30 },
  catText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  price: { fontSize: 26, fontFamily: "Inter_700Bold" },
  oldPrice: { fontSize: 16, fontFamily: "Inter_400Regular", textDecorationLine: "line-through" },
  discountTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  discountText: { fontSize: 11, color: "#fff", fontFamily: "Inter_600SemiBold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  reviewText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  bestsellerTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  bestsellerText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sizeSection: { gap: 8 },
  sizeLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sizeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sizeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  sizeChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  divider: { height: StyleSheet.hairlineWidth },
  descTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99 },
  tagText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center" },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 14,
    paddingVertical: 16,
  },
  addBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
