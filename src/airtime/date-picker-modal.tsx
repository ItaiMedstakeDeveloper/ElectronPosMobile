import { Palette, Radius } from "./theme";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface DatePickerModalProps {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: (date: Date) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Lightweight calendar date picker built with core React Native components only.
 * Avoids adding a native date-picker dependency (which would require a rebuild).
 */

export function DatePickerModal({
  visible,
  value,
  onClose,
  onSelect,
}: DatePickerModalProps) {
  // The month currently displayed in the grid.
  const [viewDate, setViewDate] = useState(new Date(value));

  // Re-sync the displayed month whenever the picker is (re)opened.
  useEffect(() => {
    if (visible) {
      setViewDate(new Date(value));
    }
  }, [visible, value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const today = new Date();

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build the grid cells (leading blanks + days).
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const goToMonth = (delta: number) => {
    setViewDate(new Date(year, month + delta, 1));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} style={styles.card}>
          {/* Header with month navigation */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => goToMonth(-1)}
            >
              <Ionicons name="chevron-back" size={22} color={Palette.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {MONTHS[month]} {year}
            </Text>
            <TouchableOpacity
              style={styles.navBtn}
              onPress={() => goToMonth(1)}
            >
              <Ionicons name="chevron-forward" size={22} color={Palette.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday labels */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => (
              <View key={i} style={styles.weekCell}>
                <Text style={styles.weekLabel}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.grid}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={idx} style={styles.dayCell} />;
              }
              const cellDate = new Date(year, month, day);
              const selected = isSameDay(cellDate, value);
              const isToday = isSameDay(cellDate, today);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    !selected && isToday && styles.dayCellToday,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => onSelect(cellDate)}
                >
                  <Text
                    style={[styles.dayText, selected && styles.dayTextSelected]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.todayBtn}
              onPress={() => onSelect(new Date())}
            >
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: Palette.card,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Palette.border,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.icon,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.input,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: Palette.text,
  },
  weekRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: "center",
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: Palette.textMuted,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 2,
  },
  dayCellSelected: {
    backgroundColor: Palette.accent,
    borderRadius: 999,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Palette.accent,
    borderRadius: 999,
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: Palette.text,
  },
  dayTextSelected: {
    color: Palette.background,
    fontWeight: "800",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  todayBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.button,
    alignItems: "center",
    backgroundColor: Palette.input,
    borderWidth: 1,
    borderColor: Palette.border,
  },
  todayBtnText: {
    color: Palette.accent,
    fontWeight: "800",
    fontSize: 14,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.button,
    alignItems: "center",
    backgroundColor: Palette.accent,
  },
  closeBtnText: {
    color: Palette.background,
    fontWeight: "800",
    fontSize: 14,
  },
});
