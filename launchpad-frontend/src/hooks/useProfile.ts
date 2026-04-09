import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { username: string; bio: string }) =>
      updateProfile(walletAddress, data),
    onSuccess: (updatedProfile: UserProfile) => {
      queryClient.setQueryData(['profile', walletAddress], updatedProfile);
    },
  });
}

export function useFollowUser(walletAddress: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => followUser(walletAddress),
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => unfollowUser(walletAddress),
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
