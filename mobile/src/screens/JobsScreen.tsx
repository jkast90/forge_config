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
import type { Job, JobStatus, JobType } from '../core';
import { useJobs, useDevices, formatRelativeTime, getJobTypeBadgeVariant } from '../core';
import {
  Card,
  Button,
  EmptyState,
  LoadingState,
  ErrorState,
  Modal,
} from '../components';
import { useAppTheme } from '../context';

function getStatusColor(status: JobStatus, colors: any) {
  switch (status) {
    case 'completed': return colors.success;
    case 'failed': return colors.error;
    case 'running': return colors.accentBlue;
    case 'queued': return colors.textMuted;
    default: return colors.textMuted;
  }
}

function getStatusIcon(status: JobStatus): keyof typeof MaterialIcons.glyphMap {
  switch (status) {
    case 'completed': return 'check-circle';
    case 'failed': return 'error';
    case 'running': return 'play-circle-outline';
    case 'queued': return 'schedule';
    default: return 'help-outline';
  }
}

function getTypeIcon(type: JobType): keyof typeof MaterialIcons.glyphMap {
  switch (type) {
    case 'command': return 'terminal';
    case 'deploy': return 'cloud-upload';
    case 'webhook': return 'webhook';
    case 'apply_template': return 'description';
    default: return 'help-outline';
  }
}

export function JobsScreen() {
  const { colors } = useAppTheme();
  const { jobs, loading, error, refresh } = useJobs();
  const { devices } = useDevices();

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all');

  const deviceMap = useMemo(() => {
    const map: Record<number, { hostname: string; ip: string }> = {};
    devices.forEach(d => { map[d.id] = { hostname: d.hostname, ip: d.ip }; });
    return map;
  }, [devices]);

  const stats = useMemo(() => {
    const s = { completed: 0, failed: 0, running: 0, queued: 0 };
    jobs.forEach(j => { if (j.status in s) s[j.status as keyof typeof s]++; });
    return s;
  }, [jobs]);

  const filteredJobs = useMemo(() =>
    statusFilter === 'all' ? jobs : jobs.filter(j => j.status === statusFilter),
  [jobs, statusFilter]);

  const getDuration = (job: Job) => {
    if (!job.started_at) return null;
    const start = new Date(job.started_at).getTime();
    const end = job.completed_at ? new Date(job.completed_at).getTime() : Date.now();
    const ms = end - start;
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const renderJob = ({ item }: { item: Job }) => {
    const device = deviceMap[item.device_id];
    const statusColor = getStatusColor(item.status, colors);
    const duration = getDuration(item);

    return (
      <Pressable onPress={() => setSelectedJob(item)}>
        <Card style={styles.jobCard}>
          <View style={styles.jobHeader}>
            <MaterialIcons name={getStatusIcon(item.status)} size={20} color={statusColor} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <View style={styles.jobTitleRow}>
                <Text style={[styles.jobDevice, { color: colors.textPrimary }]}>
                  {device?.hostname || item.device_id}
                </Text>
                <Text style={[styles.jobTime, { color: colors.textMuted }]}>
                  {formatRelativeTime(item.created_at)}
                </Text>
              </View>
              {device?.ip && (
                <Text style={[styles.jobIp, { color: colors.textMuted }]}>{device.ip}</Text>
              )}
            </View>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
              <Text style={[styles.badgeText, { color: statusColor }]}>{item.status}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.bgSecondary }]}>
              <MaterialIcons name={getTypeIcon(item.job_type)} size={12} color={colors.textMuted} />
              <Text style={[styles.badgeText, { color: colors.textMuted }]}>{item.job_type}</Text>
            </View>
            {duration && (
              <Text style={[styles.durationText, { color: colors.textMuted }]}>{duration}</Text>
            )}
          </View>

          {item.command && (
            <View style={[styles.commandBox, { backgroundColor: colors.bgSecondary }]}>
              <Text style={[styles.commandText, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]} numberOfLines={2}>
                {item.command}
              </Text>
            </View>
          )}

          {item.error && (
            <Text style={[styles.errorText, { color: colors.error }]} numberOfLines={1}>
              {item.error}
            </Text>
          )}
        </Card>
      </Pressable>
    );
  };

  if (loading) return <LoadingState message="Loading jobs..." />;
  if (error) return <ErrorState title="Error" message={error} primaryAction={{ label: 'Retry', onPress: refresh }} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Stats bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        {[
          { key: 'all' as const, label: 'All', count: jobs.length, color: colors.textPrimary },
          { key: 'completed' as const, label: 'Passed', count: stats.completed, color: colors.success },
          { key: 'failed' as const, label: 'Failed', count: stats.failed, color: colors.error },
          { key: 'running' as const, label: 'Running', count: stats.running, color: colors.accentBlue },
          { key: 'queued' as const, label: 'Queued', count: stats.queued, color: colors.textMuted },
        ].map(s => (
          <Pressable
            key={s.key}
            style={[styles.statChip, statusFilter === s.key && { backgroundColor: `${s.color}15`, borderColor: s.color, borderWidth: 1 }]}
            onPress={() => setStatusFilter(s.key)}
          >
            <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filteredJobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJob}
        ListEmptyComponent={<EmptyState message="No jobs" />}
        contentContainerStyle={filteredJobs.length === 0 ? styles.emptyList : undefined}
      />

      {/* Job Detail Modal */}
      <Modal
        visible={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        title="Job Detail"
        size="large"
      >
        {selectedJob && (
          <View style={styles.detailContent}>
            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Status</Text>
              <View style={styles.detailRow}>
                <MaterialIcons name={getStatusIcon(selectedJob.status)} size={20} color={getStatusColor(selectedJob.status, colors)} />
                <Text style={[styles.detailValue, { color: getStatusColor(selectedJob.status, colors) }]}>
                  {selectedJob.status.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.detailSection}>
              <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Info</Text>
              <DetailItem label="Type" value={selectedJob.job_type} colors={colors} />
              <DetailItem label="Device" value={deviceMap[selectedJob.device_id]?.hostname || String(selectedJob.device_id)} colors={colors} />
              <DetailItem label="IP" value={deviceMap[selectedJob.device_id]?.ip} colors={colors} />
              <DetailItem label="Created" value={formatRelativeTime(selectedJob.created_at)} colors={colors} />
              {selectedJob.started_at && <DetailItem label="Started" value={formatRelativeTime(selectedJob.started_at)} colors={colors} />}
              {selectedJob.completed_at && <DetailItem label="Completed" value={formatRelativeTime(selectedJob.completed_at)} colors={colors} />}
              {getDuration(selectedJob) && <DetailItem label="Duration" value={getDuration(selectedJob)!} colors={colors} />}
            </View>

            {selectedJob.command && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Command</Text>
                <View style={[styles.codeBlock, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.codeText, { color: colors.accentCyan, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                    {selectedJob.command}
                  </Text>
                </View>
              </View>
            )}

            {selectedJob.output && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Output</Text>
                <View style={[styles.codeBlock, { backgroundColor: colors.bgSecondary }]}>
                  <Text style={[styles.codeText, { color: colors.success, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                    {selectedJob.output}
                  </Text>
                </View>
              </View>
            )}

            {selectedJob.error && (
              <View style={styles.detailSection}>
                <Text style={[styles.detailSectionTitle, { color: colors.textPrimary }]}>Error</Text>
                <View style={[styles.codeBlock, { backgroundColor: `${colors.error}10` }]}>
                  <Text style={[styles.codeText, { color: colors.error, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }]}>
                    {selectedJob.error}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}
      </Modal>
    </View>
  );
}

function DetailItem({ label, value, colors }: { label: string; value?: string | null; colors: any }) {
  if (!value) return null;
  return (
    <View style={detailStyles.row}>
      <Text style={[detailStyles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[detailStyles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 4 },
  label: { fontSize: 13, width: 80 },
  value: { fontSize: 13, flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  statChip: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statCount: { fontSize: 16, fontWeight: 'bold' },
  statLabel: { fontSize: 10, marginTop: 2 },
  jobCard: { marginHorizontal: 16, marginBottom: 8 },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  jobTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  jobDevice: { fontSize: 15, fontWeight: '600' },
  jobIp: { fontSize: 12 },
  jobTime: { fontSize: 11 },
  badgeRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  durationText: { fontSize: 11, marginLeft: 'auto' },
  commandBox: { padding: 8, borderRadius: 6, marginBottom: 6 },
  commandText: { fontSize: 12 },
  errorText: { fontSize: 12, marginBottom: 4 },
  detailContent: { padding: 4 },
  detailSection: { marginBottom: 20 },
  detailSectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailValue: { fontSize: 15, fontWeight: '600' },
  codeBlock: { padding: 12, borderRadius: 8 },
  codeText: { fontSize: 12, lineHeight: 18 },
  emptyList: { flex: 1, justifyContent: 'center' },
});
