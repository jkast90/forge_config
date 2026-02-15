import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppSelector } from '../core';
import { Card } from '../components';
import { useAppTheme } from '../context';

type SliceKey = string;

export function DataExplorerScreen() {
  const { colors } = useAppTheme();
  const state = useAppSelector((s: any) => s);
  const [selectedSlice, setSelectedSlice] = useState<SliceKey | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  const slices = useMemo(() => {
    if (!state || typeof state !== 'object') return [];
    return Object.keys(state).sort().map(key => ({
      key,
      itemCount: getItemCount((state as any)[key]),
    }));
  }, [state]);

  const selectedData = useMemo(() => {
    if (!selectedSlice || !state) return null;
    return (state as any)[selectedSlice];
  }, [state, selectedSlice]);

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderValue = (value: any, path: string, depth: number): React.ReactNode => {
    if (value === null || value === undefined) {
      return <Text style={[styles.valueNull, { color: colors.textMuted }]}>null</Text>;
    }
    if (typeof value === 'boolean') {
      return <Text style={[styles.valueBool, { color: value ? colors.success : colors.error }]}>{String(value)}</Text>;
    }
    if (typeof value === 'number') {
      return <Text style={[styles.valueNumber, { color: '#f59e0b' }]}>{value}</Text>;
    }
    if (typeof value === 'string') {
      const truncated = value.length > 100 ? value.slice(0, 100) + '...' : value;
      return <Text style={[styles.valueString, { color: colors.success }]}>"{truncated}"</Text>;
    }
    if (Array.isArray(value)) {
      const isExpanded = expandedPaths.has(path);
      return (
        <View>
          <Pressable onPress={() => togglePath(path)} style={styles.expandRow}>
            <MaterialIcons
              name={isExpanded ? 'expand-more' : 'chevron-right'}
              size={16}
              color={colors.textMuted}
            />
            <Text style={[styles.typeLabel, { color: colors.accentBlue }]}>Array[{value.length}]</Text>
          </Pressable>
          {isExpanded && depth < 4 && value.slice(0, 50).map((item, i) => (
            <View key={i} style={[styles.nested, { borderLeftColor: colors.border }]}>
              <Text style={[styles.indexLabel, { color: colors.textMuted }]}>[{i}]</Text>
              {renderValue(item, `${path}[${i}]`, depth + 1)}
            </View>
          ))}
          {isExpanded && value.length > 50 && (
            <Text style={[styles.truncated, { color: colors.textMuted }]}>...{value.length - 50} more items</Text>
          )}
        </View>
      );
    }
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      const isExpanded = expandedPaths.has(path);
      return (
        <View>
          <Pressable onPress={() => togglePath(path)} style={styles.expandRow}>
            <MaterialIcons
              name={isExpanded ? 'expand-more' : 'chevron-right'}
              size={16}
              color={colors.textMuted}
            />
            <Text style={[styles.typeLabel, { color: colors.accentCyan }]}>Object {`{${keys.length}}`}</Text>
          </Pressable>
          {isExpanded && depth < 4 && keys.slice(0, 30).map(k => (
            <View key={k} style={[styles.nested, { borderLeftColor: colors.border }]}>
              <Text style={[styles.keyLabel, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{k}: </Text>
              {renderValue(value[k], `${path}.${k}`, depth + 1)}
            </View>
          ))}
          {isExpanded && keys.length > 30 && (
            <Text style={[styles.truncated, { color: colors.textMuted }]}>...{keys.length - 30} more keys</Text>
          )}
        </View>
      );
    }
    return <Text style={[styles.valueString, { color: colors.textPrimary }]}>{String(value)}</Text>;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {!selectedSlice ? (
        /* Slice list */
        <FlatList
          data={slices}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Pressable onPress={() => { setSelectedSlice(item.key); setExpandedPaths(new Set()); }}>
              <Card style={styles.sliceCard}>
                <View style={styles.sliceRow}>
                  <MaterialIcons name="storage" size={20} color={colors.accentBlue} />
                  <Text style={[styles.sliceName, { color: colors.textPrimary }]}>{item.key}</Text>
                  <View style={[styles.countBadge, { backgroundColor: colors.bgSecondary }]}>
                    <Text style={[styles.countText, { color: colors.accentBlue }]}>
                      {item.itemCount !== null ? `${item.itemCount} items` : 'object'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </View>
              </Card>
            </Pressable>
          )}
        />
      ) : (
        /* Slice detail */
        <View style={styles.flex}>
          <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setSelectedSlice(null)} style={styles.backBtn}>
              <MaterialIcons name="arrow-back" size={20} color={colors.accentBlue} />
            </Pressable>
            <MaterialIcons name="storage" size={18} color={colors.accentBlue} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{selectedSlice}</Text>
          </View>
          <FlatList
            data={[{ key: 'root' }]}
            keyExtractor={(item) => item.key}
            contentContainerStyle={styles.listContent}
            renderItem={() => (
              <View style={styles.dataContent}>
                {renderValue(selectedData, selectedSlice, 0)}
              </View>
            )}
          />
        </View>
      )}
    </View>
  );
}

function getItemCount(value: any): number | null {
  if (!value || typeof value !== 'object') return null;
  // Check common Redux slice patterns
  if (Array.isArray(value)) return value.length;
  // Check for items/data arrays within slice
  const arrayKeys = ['items', 'data', 'list', 'entities'];
  for (const key of arrayKeys) {
    if (Array.isArray(value[key])) return value[key].length;
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  listContent: { padding: 16 },
  sliceCard: { marginBottom: 8 },
  sliceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sliceName: { fontSize: 15, fontWeight: '600', flex: 1 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  countText: { fontSize: 11 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
  },
  backBtn: { marginRight: 4 },
  headerTitle: { fontSize: 16, fontWeight: 'bold' },
  dataContent: { paddingBottom: 32 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 },
  typeLabel: { fontSize: 12, fontWeight: '500' },
  nested: { marginLeft: 16, paddingLeft: 8, borderLeftWidth: 1 },
  keyLabel: { fontSize: 12 },
  indexLabel: { fontSize: 11, marginRight: 4 },
  valueNull: { fontSize: 12, fontStyle: 'italic' },
  valueBool: { fontSize: 12, fontWeight: '500' },
  valueNumber: { fontSize: 12 },
  valueString: { fontSize: 12 },
  truncated: { fontSize: 11, fontStyle: 'italic', marginLeft: 24, paddingVertical: 4 },
});
