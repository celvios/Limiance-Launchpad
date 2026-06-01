'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/BscWalletProvider';
import { getAuthToken, loginWithWallet } from '@/lib/session';
import {
  fetchProfile,
  updateProfile,
  followUser,
  unfollowUser,
  fetchProfileTokens,
  fetchProfileHoldings,
  fetchProfileTrades,
  fetchProfileComments,
} from '@/lib/api';
import type { UserProfile } from '@/lib/types';

export function useProfile(walletAddress: string) {
  return useQuery({
    queryKey: ['profile', walletAddress],
    queryFn: () => fetchProfile(walletAddress),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

export function useUpdateProfile(walletAddress: string) {
  const { address, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { username: string; bio: string; profilePicUri?: string }) => {
      if (!address || !signMessage) throw new Error('Wallet not connected');
      let token = getAuthToken(walletAddress);
      if (!token) token = await loginWithWallet(walletAddress, signMessage);
      return updateProfile(walletAddress, data, token);
    },
    onSuccess: (updatedProfile: UserProfile) => {
      queryClient.setQueryData(['profile', walletAddress], updatedProfile);
    },
  });
}

export function useFollowUser(walletAddress: string) {
  const { address, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!address || !signMessage) throw new Error('Wallet not connected');
      const followerWallet = address;
      let token = getAuthToken(followerWallet);
      if (!token) token = await loginWithWallet(followerWallet, signMessage);
      return followUser(followerWallet, walletAddress, token);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['profile', walletAddress] });
      const prev = queryClient.getQueryData<UserProfile>(['profile', walletAddress]);
      if (prev) {
        queryClient.setQueryData(['profile', walletAddress], {
          ...prev,
          isFollowing: true,
          followerCount: prev.followerCount + 1,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['profile', walletAddress], context.prev);
      }
    },
  });
}

export function useUnfollowUser(walletAddress: string) {
  const { address, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!address || !signMessage) throw new Error('Wallet not connected');
      const followerWallet = address;
      let token = getAuthToken(followerWallet);
      if (!token) token = await loginWithWallet(followerWallet, signMessage);
      return unfollowUser(followerWallet, walletAddress, token);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['profile', walletAddress] });
      const prev = queryClient.getQueryData<UserProfile>(['profile', walletAddress]);
      if (prev) {
        queryClient.setQueryData(['profile', walletAddress], {
          ...prev,
          isFollowing: false,
          followerCount: Math.max(0, prev.followerCount - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['profile', walletAddress], context.prev);
      }
    },
  });
}

export function useProfileTokens(walletAddress: string) {
  return useQuery({
    queryKey: ['profile-tokens', walletAddress],
    queryFn: () => fetchProfileTokens(walletAddress),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

export function useProfileHoldings(walletAddress: string) {
  return useQuery({
    queryKey: ['profile-holdings', walletAddress],
    queryFn: () => fetchProfileHoldings(walletAddress),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

export function useProfileTrades(walletAddress: string) {
  return useQuery({
    queryKey: ['profile-trades', walletAddress],
    queryFn: () => fetchProfileTrades(walletAddress),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

export function useProfileComments(walletAddress: string) {
  return useQuery({
    queryKey: ['profile-comments', walletAddress],
    queryFn: () => fetchProfileComments(walletAddress),
    enabled: !!walletAddress,
    staleTime: 60_000,
  });
}

