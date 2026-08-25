import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { colors, spacing, radius } from "@/theme";
import { navSectionsFor, NavSection, NavLeaf } from "@/navigation";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const isActive = (pathname: string, href: string) =>
    pathname === href || pathname.startsWith(href + "/");

// Which groups should start expanded: any group containing the active route.
function initialOpen(
    sections: NavSection[],
    pathname: string,
): Record<string, boolean> {
    const open: Record<string, boolean> = {};
    for (const sec of sections) {
        if (sec.type === "group") {
            open[sec.label] = sec.children.some((c) =>
                isActive(pathname, c.href),
            );
        }
    }
    return open;
}

// Shared grouped navigation (accordion). `dark` renders the sidebar palette; the
// light palette is used inside the mobile "More" screen.
export function NavMenu({
    dark,
    onNavigate,
}: {
    dark?: boolean;
    onNavigate?: () => void;
}) {
    const pathname = usePathname();
    const { count } = useCart();
    const { role } = useAuth();
    const sections = navSectionsFor(role);
    const [open, setOpen] = useState<Record<string, boolean>>(() =>
        initialOpen(sections, pathname),
    );

    const t = theme(dark);

    return (
        <View style={{ gap: 2 }}>
            {sections.map((sec) => {
                if (sec.type === "link") {
                    const active = isActive(pathname, sec.href);
                    return (
                        <NavLink
                            key={sec.href}
                            leaf={{
                                label: sec.label,
                                href: sec.href,
                                icon: sec.icon,
                            }}
                            active={active}
                            t={t}
                            cta={sec.cta}
                            badge={
                                sec.href === "/cart" && count > 0
                                    ? count
                                    : undefined
                            }
                            onNavigate={onNavigate}
                        />
                    );
                }
                const groupActive = sec.children.some((c) =>
                    isActive(pathname, c.href),
                );
                const expanded = open[sec.label];
                return (
                    <View key={sec.label}>
                        <Pressable
                            style={StyleSheet.flatten([
                                t.groupHeader,
                                groupActive && t.groupHeaderActive,
                            ])}
                            onPress={() =>
                                setOpen((o) => ({
                                    ...o,
                                    [sec.label]: !o[sec.label],
                                }))
                            }
                        >
                            <Ionicons
                                name={sec.icon}
                                size={20}
                                color={
                                    groupActive ? t.activeColor : t.iconColor
                                }
                            />
                            <Text
                                style={[
                                    t.groupLabel,
                                    groupActive && { color: t.activeColor },
                                ]}
                            >
                                {sec.label}
                            </Text>
                            <Ionicons
                                name={expanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color={t.iconColor}
                            />
                        </Pressable>
                        {expanded ? (
                            <View style={t.children}>
                                {sec.children.map((leaf) => (
                                    <NavLink
                                        key={leaf.href}
                                        leaf={leaf}
                                        active={isActive(pathname, leaf.href)}
                                        t={t}
                                        child
                                        onNavigate={onNavigate}
                                    />
                                ))}
                            </View>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}

function NavLink({
    leaf,
    active,
    t,
    child,
    cta,
    badge,
    onNavigate,
}: {
    leaf: NavLeaf;
    active: boolean;
    t: ReturnType<typeof theme>;
    child?: boolean;
    cta?: boolean;
    badge?: number;
    onNavigate?: () => void;
}) {
    return (
        <Link href={leaf.href as any} asChild>
            {/* Flatten: Link `asChild` merges the child's style via object-spread, which
          corrupts style ARRAYS into numeric keys on react-native-web. */}
            <Pressable
                onPress={onNavigate}
                style={StyleSheet.flatten([
                    t.item,
                    child && t.itemChild,
                    cta && t.cta,
                    active && !cta && t.itemActive,
                ])}
            >
                <Ionicons
                    name={leaf.icon}
                    size={child ? 18 : 20}
                    color={
                        cta ? "#2b2b2b" : active ? t.activeColor : t.iconColor
                    }
                />
                <Text
                    style={[
                        t.itemLabel,
                        child && t.itemChildLabel,
                        cta && t.ctaLabel,
                        active &&
                            !cta && { color: t.activeColor, fontWeight: "600" },
                    ]}
                >
                    {leaf.label}
                </Text>
                {badge ? (
                    <View style={t.badge}>
                        <Text style={t.badgeText}>{badge}</Text>
                    </View>
                ) : null}
            </Pressable>
        </Link>
    );
}

// Palette + shared shapes for the two variants.
function theme(dark?: boolean) {
    const iconColor = dark ? "#cfd2d6" : colors.textMuted;
    const labelColor = dark ? "#e7e9ec" : colors.text;
    const activeColor = dark ? colors.accent : colors.primary;
    const hoverBg = dark ? colors.sidebarHover : colors.bg;
    const activeBg = dark ? colors.accentSoft : colors.primarySoft;

    const styles = StyleSheet.create({
        groupHeader: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: 11,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
        },
        groupHeaderActive: { backgroundColor: hoverBg },
        groupLabel: {
            flex: 1,
            color: labelColor,
            fontSize: 15,
            fontWeight: "600",
        },
        children: { paddingLeft: spacing.md, marginBottom: 2 },
        item: {
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            paddingVertical: 11,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
        },
        itemChild: { paddingVertical: 9 },
        itemActive: {
            backgroundColor: activeBg,
            borderLeftWidth: 3,
            borderLeftColor: activeColor,
            paddingLeft: spacing.md - 3,
        },
        itemLabel: {
            flex: 1,
            color: labelColor,
            fontSize: 15,
            fontWeight: "500",
        },
        itemChildLabel: {
            fontSize: 14,
            color: dark ? "#b6b9bd" : colors.textMuted,
            fontWeight: "500",
        },
        cta: {
            backgroundColor: colors.accent,
            marginVertical: 6,
            shadowColor: "#000",
            shadowOpacity: 0.15,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
        },
        ctaLabel: {
            flex: 1,
            color: "#2b2b2b",
            fontSize: 15,
            fontWeight: "700",
        },
        badge: {
            backgroundColor: dark ? colors.accent : colors.primary,
            borderRadius: 999,
            minWidth: 22,
            paddingHorizontal: 6,
            paddingVertical: 1,
            alignItems: "center",
        },
        badgeText: {
            color: dark ? "#2b2b2b" : "#fff",
            fontSize: 12,
            fontWeight: "700",
        },
    });

    return { ...styles, iconColor, activeColor };
}
