import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProductCard } from "@/components/ProductCard";
import { useColors } from "@/hooks/useColors";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/api";

const CATEGORIES = [
  "All",
  "Authentic Indian Attars",
  "Modern Attars",
  "Next Gen Fragrances",
  "Discovery Set",
  "Ruh / Absolute Oil",
  "Eau De Parfum",
  "Wellness",
];

const CAT_LABELS: Record<string, string> = {
  All: "All",
  "Authentic Indian Attars": "Authentic Attars",
  "Modern Attars": "Modern Attars",
  "Next Gen Fragrances": "Next Gen",
  "Discovery Set": "Discovery Sets",
  "Ruh / Absolute Oil": "Ruh / Oil",
  "Eau De Parfum": "Eau De Parfum",
  Wellness: "Wellness",
};

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeCategory, setActiveCategory] = useState("All");
  const isWeb = Platform.OS === "web";

  const { data: products = [], isLoading, refetch } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => apiGet<Product[]>("/api/products"),
    staleTime: 5 * 60 * 1000,
  });

  const filtered =
    activeCategory === "All"
      ? products
      : products.filter((p) => p.cat === activeCategory);

  const renderItem = ({ item, index }: { item: Product; index: number }) => (
    <View style={[styles.cardWrap, index % 2 === 0 ? { marginRight: 6 } : { marginLeft: 6 }]}>
      <ProductCard product={item} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Ruh Imperium
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Pure Indian Attars from Kannauj
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.filterChip,
              { borderColor: colors.border },
              activeCategory === cat && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeCategory === cat ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {CAT_LABELS[cat] ?? cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Loading fragrances...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.id}`}
          numColumns={2}
          contentContainerStyle={[
            styles.grid,
            { paddingBottom: isWeb ? 34 + 84 : insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No products in this category
              </Text>
            </View>
          }
          ListHeaderComponent={
            <Text style={[styles.countText, { color: colors.mutedForeground }]}>
              {filtered.length} {filtered.length === 1 ? "product" : "products"}
            </Text>
          }
        />
      )}
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
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  filterScroll: {
    flexGrow: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  grid: {
    padding: 12,
  },
  cardWrap: {
    flex: 1,
    marginBottom: 12,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  countText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
});
