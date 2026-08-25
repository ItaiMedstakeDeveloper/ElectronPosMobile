import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, shadow } from '@/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({ title, subtitle, children, action }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.screenContent}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Badge({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'success' | 'danger' | 'accent' }) {
  const bg = {
    muted: '#eef1f5',
    success: '#d3f9e8',
    danger: '#ffe3e3',
    accent: colors.warningBg,
  }[tone];
  const fg = {
    muted: colors.textMuted,
    success: colors.success,
    danger: colors.danger,
    accent: '#8a6d00',
  }[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Placeholder({
  title,
  subtitle,
  icon,
  note,
}: {
  title: string;
  subtitle?: string;
  icon: IoniconName;
  note?: string;
}) {
  return (
    <Screen title={title} subtitle={subtitle}>
      <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
        <View style={s.placeholderIcon}>
          <Ionicons name={icon} size={40} color={colors.textMuted} />
        </View>
        <Badge text="Coming soon" tone="accent" />
        <Text style={s.placeholderNote}>
          {note ?? 'This screen isn’t built yet — the navigation and layout are in place.'}
        </Text>
      </Card>
    </Screen>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'accent' | 'outline';
  icon?: IoniconName;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary' ? colors.primary : variant === 'accent' ? colors.accent : 'transparent';
  const fg = variant === 'accent' ? '#2b2b2b' : variant === 'outline' ? colors.text : '#fff';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) =>
        StyleSheet.flatten([
          s.button,
          { backgroundColor: bg },
          variant === 'outline' && s.buttonOutline,
          (disabled || pressed) && { opacity: disabled ? 0.5 : 0.85 },
          style,
        ])
      }
    >
      {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text style={[s.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  icon,
  containerStyle,
  ...inputProps
}: TextInputProps & { label?: string; icon?: IoniconName; containerStyle?: ViewStyle }) {
  return (
    <View style={containerStyle}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <View style={s.fieldWrap}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={colors.textMuted}
          {...inputProps}
          style={[s.fieldInput, inputProps.style]}
        />
      </View>
    </View>
  );
}

export type Option = { label: string; value: string };

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  containerStyle,
}: {
  label?: string;
  value?: string;
  options: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={containerStyle}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <Pressable style={s.selectWrap} onPress={() => setOpen(true)}>
        <Text style={[s.selectText, !selected && s.selectPlaceholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={s.selectSheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  style={s.selectOption}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[s.selectOptionText, o.value === value && s.selectOptionActive]}
                    numberOfLines={1}
                  >
                    {o.label}
                  </Text>
                  {o.value === value ? (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  ) : null}
                </Pressable>
              ))}
              {options.length === 0 ? <Text style={s.selectEmpty}>No options</Text> : null}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function FormModal({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={s.formSheet}>
          <View style={s.formHeader}>
            <Text style={s.formTitle}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={s.formBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
          <View style={s.formFooter}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title={submitLabel} onPress={onSubmit} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenContent: { padding: spacing.lg, gap: spacing.md, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.sm },
  title: { fontSize: 25, fontWeight: '800', color: colors.text, letterSpacing: -0.4 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginTop: 3 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  placeholderIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderNote: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  buttonOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  buttonText: { fontSize: 15, fontWeight: '700' },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    outlineStyle: 'none' as any,
  },
  selectWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  selectText: { flex: 1, fontSize: 15, color: colors.text },
  selectPlaceholder: { color: colors.textMuted },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  selectSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    maxHeight: '70%',
    overflow: 'hidden',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectOptionText: { fontSize: 15, color: colors.text, flex: 1 },
  selectOptionActive: { color: colors.primary, fontWeight: '700' },
  selectEmpty: { padding: spacing.md, color: colors.textMuted, textAlign: 'center' },
  formSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    maxHeight: '90%',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  formBody: { padding: spacing.md, gap: spacing.md },
  formFooter: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
