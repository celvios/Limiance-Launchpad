'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
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
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { username: string; bio: string }) => {
      if (!publicKey || !signMessage) throw new Error('Wallet not connected');

      const timestamp = Date.now();
      const message = `ACTION:UPDATE_PROFILE|DATA:${data.username}|TIMESTAMP:${timestamp}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(sig).toString('base64');

      return updateProfile(walletAddress, data, signature, timestamp);
    },
    onSuccess: (updatedProfile: UserProfile) => {
      queryClient.setQueryData(['profile', walletAddress], updatedProfile);
    },
  });
}

export function useFollowUser(walletAddress: string) {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !signMessage) throw new Error('Wallet not connected');

      const followerWallet = publicKey.toBase58();
      const timestamp = Date.now();
      const message = `ACTION:FOLLOW|DATA:${walletAddress}|TIMESTAMP:${timestamp}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(sig).toString('base64');

      return followUser(followerWallet, walletAddress, signature, timestamp);
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
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!publicKey || !signMessage) throw new Error('Wallet not connected');

      const followerWallet = publicKey.toBase58();
      const timestamp = Date.now();
      const message = `ACTION:UNFOLLOW|DATA:${walletAddress}|TIMESTAMP:${timestamp}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(sig).toString('base64');

      return unfollowUser(followerWallet, walletAddress, signature, timestamp);
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
