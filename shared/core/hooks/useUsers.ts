import { useEffect, useCallback } from 'react';
import type { User, UserFormData } from '../types';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchUsers,
  createUser as createUserThunk,
  updateUser as updateUserThunk,
  deleteUser as deleteUserThunk,
} from '../store/slices/usersSlice';
import { addNotification } from '../services/notifications';
import { getErrorMessage } from '../utils/errors';

export interface UseUsersReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createUser: (data: UserFormData) => Promise<boolean>;
  updateUser: (id: string, data: Partial<UserFormData>) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

export function useUsers(): UseUsersReturn {
  const dispatch = useAppDispatch();
  const { items: users, loading, error } = useAppSelector((state) => state.users);

  const refresh = useCallback(async () => {
    await dispatch(fetchUsers());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchUsers());
  }, [dispatch]);

  const createUser = useCallback(async (data: UserFormData): Promise<boolean> => {
    try {
      await dispatch(createUserThunk(data)).unwrap();
      addNotification('success', 'User created');
      dispatch(fetchUsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to create user: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const updateUser = useCallback(async (id: string, data: Partial<UserFormData>): Promise<boolean> => {
    try {
      await dispatch(updateUserThunk({ id, data })).unwrap();
      addNotification('success', 'User updated');
      dispatch(fetchUsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to update user: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      await dispatch(deleteUserThunk(id)).unwrap();
      addNotification('success', 'User deleted');
      dispatch(fetchUsers());
      return true;
    } catch (err) {
      addNotification('error', `Failed to delete user: ${getErrorMessage(err)}`);
      return false;
    }
  }, [dispatch]);

  return {
    users,
    loading,
    error,
    refresh,
    createUser,
    updateUser,
    deleteUser,
  };
}
