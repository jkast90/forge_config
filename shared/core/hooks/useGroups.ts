// Group management hook - Redux-backed

import { useEffect, useCallback, useState } from 'react';
import type { Group, GroupFormData, GroupVariable } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchGroups,
  createGroup as createGroupThunk,
  updateGroup as updateGroupThunk,
  deleteGroup as deleteGroupThunk,
} from '../store/slices/groupsSlice';
import { addNotification } from '../services/notifications';
import { navigateAction } from '../services/navigation';
import { getErrorMessage } from '../utils/errors';
import { getServices } from '../services';

export interface UseGroupsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseGroupsReturn {
  groups: Group[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createGroup: (data: Partial<GroupFormData>) => Promise<boolean>;
  updateGroup: (id: number, data: Partial<GroupFormData>) => Promise<boolean>;
  deleteGroup: (id: number) => Promise<boolean>;
  // Group variables
  groupVariables: GroupVariable[];
  groupVariablesLoading: boolean;
  fetchGroupVariables: (groupId: number) => Promise<void>;
  setGroupVariable: (groupId: number, key: string, value: string) => Promise<boolean>;
  deleteGroupVariable: (groupId: number, key: string) => Promise<boolean>;
  // Membership
  members: number[];
  membersLoading: boolean;
  fetchMembers: (groupId: number) => Promise<void>;
  setMembers: (groupId: number, deviceIds: number[]) => Promise<boolean>;
  addMember: (groupId: number, deviceId: number) => Promise<boolean>;
  removeMember: (groupId: number, deviceId: number) => Promise<boolean>;
}

export function useGroups(options: UseGroupsOptions = {}): UseGroupsReturn {
  const { autoRefresh = false, refreshInterval = 30000 } = options;
  const dispatch = useAppDispatch();
  const { items: groups, loading, error } = useAppSelector((state) => state.groups);

  const [groupVariables, setGroupVariables] = useState<GroupVariable[]>([]);
  const [groupVariablesLoading, setGroupVariablesLoading] = useState(false);
  const [members, setMembers] = useState<number[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const refresh = useCallback(async () => {
    await dispatch(fetchGroups());
  }, [dispatch]);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchGroups());
  }, [dispatch]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => dispatch(fetchGroups()), refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, dispatch]);

  const createGroup = useCallback(async (data: Partial<GroupFormData>): Promise<boolean> => {
    try {
      await dispatch(createGroupThunk(data)).unwrap();
      addNotification('success', 'Group created successfully', navigateAction('View Groups', 'config', 'groups'));
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create group: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateGroup = useCallback(async (id: number, data: Partial<GroupFormData>): Promise<boolean> => {
    try {
      await dispatch(updateGroupThunk({ id, data })).unwrap();
      addNotification('success', 'Group updated successfully', navigateAction('View Groups', 'config', 'groups'));
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update group: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteGroup = useCallback(async (id: number): Promise<boolean> => {
    try {
      await dispatch(deleteGroupThunk(id)).unwrap();
      addNotification('success', 'Group deleted', navigateAction('View Groups', 'config', 'groups'));
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete group: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  // Group variables
  const fetchGroupVariables = useCallback(async (groupId: number) => {
    setGroupVariablesLoading(true);
    try {
      const vars = await getServices().groups.listVariables(groupId);
      setGroupVariables(vars);
    } catch (err) {
      addNotification('error', `Failed to load group variables: ${getErrorMessage(err)}`);
    } finally {
      setGroupVariablesLoading(false);
    }
  }, []);

  const setGroupVariable = useCallback(async (groupId: number, key: string, value: string): Promise<boolean> => {
    try {
      await getServices().groups.setVariable(groupId, key, value);
      addNotification('success', `Variable "${key}" set`, navigateAction('View Groups', 'config', 'groups'));
      await fetchGroupVariables(groupId);
      return true;
    } catch (err) {
      addNotification('error', `Failed to set variable: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchGroupVariables]);

  const deleteGroupVariable = useCallback(async (groupId: number, key: string): Promise<boolean> => {
    try {
      await getServices().groups.deleteVariable(groupId, key);
      addNotification('success', `Variable "${key}" deleted`, navigateAction('View Groups', 'config', 'groups'));
      await fetchGroupVariables(groupId);
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete variable: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchGroupVariables]);

  // Membership
  const fetchMembers = useCallback(async (groupId: number) => {
    setMembersLoading(true);
    try {
      const deviceIds = await getServices().groups.listMembers(groupId);
      setMembers(deviceIds);
    } catch (err) {
      addNotification('error', `Failed to load group members: ${getErrorMessage(err)}`);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const setMembersAction = useCallback(async (groupId: number, deviceIds: number[]): Promise<boolean> => {
    try {
      await getServices().groups.setMembers(groupId, deviceIds);
      addNotification('success', 'Members updated', navigateAction('View Groups', 'config', 'groups'));
      await fetchMembers(groupId);
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update members: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchMembers, dispatch]);

  const addMember = useCallback(async (groupId: number, deviceId: number): Promise<boolean> => {
    try {
      await getServices().groups.addMember(groupId, deviceId);
      addNotification('success', 'Device added to group', navigateAction('View Groups', 'config', 'groups'));
      await fetchMembers(groupId);
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to add device: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchMembers, dispatch]);

  const removeMember = useCallback(async (groupId: number, deviceId: number): Promise<boolean> => {
    try {
      await getServices().groups.removeMember(groupId, deviceId);
      addNotification('success', 'Device removed from group', navigateAction('View Groups', 'config', 'groups'));
      await fetchMembers(groupId);
      dispatch(fetchGroups());
      return true;
    } catch (err) {
      addNotification('error', `Failed to remove device: ${getErrorMessage(err)}`);
      return false;
    }
  }, [fetchMembers, dispatch]);

  return {
    groups,
    loading,
    error,
    refresh,
    createGroup,
    updateGroup,
    deleteGroup,
    groupVariables,
    groupVariablesLoading,
    fetchGroupVariables,
    setGroupVariable,
    deleteGroupVariable,
    members,
    membersLoading,
    fetchMembers,
    setMembers: setMembersAction,
    addMember,
    removeMember,
  };
}
