import { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ResolvedVariable, ResolutionLayer } from '../core';
import { useResolvedVariables, useDevices } from '../core';
import {
  Card,
  Button,
  EmptyState,
  LoadingState,
  FormSelect,
} from '../components';
import { useAppTheme } from '../context';

export function InspectorScreen() {
  const { colors } = useAppTheme();
  const { result, loading, fetch, clear } = useResolvedVariables();
  const { devices } = useDevices();

  const [selectedDeviceId, setSelectedDeviceId] = useState('');

  const deviceOptions = useMemo(() => [
    { value: '', label: 'Select a device...' },
    ...devices.map(d => ({ value: String(d.id), label: d.hostname || d.ip || String(d.id) })),
  ], [devices]);

  const handleResolve = async () => {
    if (selectedDeviceId) {
      await fetch(Number(selectedDeviceId));
    }
  };

  const getSourceIcon = (sourceType: string): keyof typeof MaterialIcons.glyphMap => {
    switch (sourceType) {
      case 'host': return 'computer';
      case 'group': return 'group';
      case 'all': return 'public';
      default: return 'help-outline';
    }
  };

  const getSourceColor = (sourceType: string) => {
    switch (sourceType) {
      case 'host': return colors.success;
      case 'group': return colors.accentBlue;
      case 'all': return colors.accentCyan;
      default: return colors.textMuted;
    }
  };

  const renderVariable = ({ item }: { item: ResolvedVariable }) => (
    <View style={[styles.varRow, { borderBottomColor: colors.border }]}>
      <View style={styles.varKeyCol}>
        <Text style={[styles.varKey, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
          {item.key}
        </Text>
      </View>
      <View style={styles.varValueCol}>
        <Text style={[styles.varValue, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
          {item.value}
        </Text>
      </View>
      <View style={styles.varSourceCol}>
        <MaterialIcons name={getSourceIcon(item.source_type)} size={14} color={getSourceColor(item.source_type)} />
        <Text style={[styles.sourceText, { color: getSourceColor(item.source_type) }]}>{item.source_name}</Text>
      </View>
    </View>
  );

  const renderLayer = ({ item }: { item: ResolutionLayer }) => {
    const varEntries = Object.entries(item.variables);
    return (
      <Card style={styles.layerCard}>
        <View style={styles.layerHeader}>
          <MaterialIcons name={getSourceIcon(item.source_type)} size={18} color={getSourceColor(item.source_type)} />
          <Text style={[styles.layerName, { color: colors.textPrimary }]}>{item.source_name}</Text>
          <View style={[styles.typeBadge, { backgroundColor: `${getSourceColor(item.source_type)}20` }]}>
            <Text style={[styles.typeBadgeText, { color: getSourceColor(item.source_type) }]}>{item.source_type}</Text>
          </View>
          <Text style={[styles.precedenceText, { color: colors.textMuted }]}>#{item.precedence}</Text>
        </View>
        {varEntries.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No variables</Text>
        ) : (
          varEntries.map(([k, v]) => (
            <View key={k} style={[styles.layerVar, { borderBottomColor: colors.border }]}>
              <Text style={[styles.layerVarKey, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{k}</Text>
              <Text style={[styles.layerVarValue, { color: colors.textPrimary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>{v}</Text>
            </View>
          ))
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <View style={styles.header}>
        <FormSelect
          label="Device"
          value={selectedDeviceId}
          options={deviceOptions}
          onChange={setSelectedDeviceId}
          placeholder="Select a device..."
        />
        <View style={styles.actionRow}>
          <Button title="Resolve" onPress={handleResolve} icon="search" disabled={!selectedDeviceId} />
          {result && <Button title="Clear" onPress={clear} variant="secondary" />}
        </View>
      </View>

      {loading ? (
        <LoadingState message="Resolving variables..." />
      ) : !result ? (
        <EmptyState
          message="Select a device and click Resolve to see variable resolution"
          icon="search"
        />
      ) : (
        <FlatList
          data={[{ type: 'resolved' }, { type: 'layers' }] as const}
          keyExtractor={(item) => item.type}
          renderItem={({ item: section }) => {
            if (section.type === 'resolved') {
              return (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    Resolved Variables ({result.resolved.length})
                  </Text>
                  {/* Column headers */}
                  <View style={[styles.varRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.varKeyCol}>
                      <Text style={[styles.colHeader, { color: colors.textMuted }]}>Key</Text>
                    </View>
                    <View style={styles.varValueCol}>
                      <Text style={[styles.colHeader, { color: colors.textMuted }]}>Value</Text>
                    </View>
                    <View style={styles.varSourceCol}>
                      <Text style={[styles.colHeader, { color: colors.textMuted }]}>Source</Text>
                    </View>
                  </View>
                  {result.resolved.map(v => (
                    <View key={v.key}>
                      {renderVariable({ item: v })}
                    </View>
                  ))}
                </View>
              );
            }
            return (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Resolution Order ({result.resolution_order.length} layers)
                </Text>
                {result.resolution_order.map((layer, i) => (
                  <View key={`${layer.source}-${i}`}>
                    {renderLayer({ item: layer })}
                  </View>
                ))}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  colHeader: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  varRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  varKeyCol: { width: 120 },
  varValueCol: { flex: 1, paddingHorizontal: 8 },
  varSourceCol: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 100 },
  varKey: { fontSize: 12 },
  varValue: { fontSize: 12 },
  sourceText: { fontSize: 11 },
  layerCard: { marginBottom: 8 },
  layerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  layerName: { fontSize: 15, fontWeight: '600', flex: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeBadgeText: { fontSize: 11, fontWeight: '500' },
  precedenceText: { fontSize: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  layerVar: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 0.5 },
  layerVarKey: { fontSize: 12, width: 120 },
  layerVarValue: { fontSize: 12, flex: 1 },
});
