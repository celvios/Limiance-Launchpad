'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchComments, postComment, upvoteComment } from '@/lib/api';
import { getAuthToken, loginWithWallet } from '@/lib/session';
import type { CommentSort, Comment } from '@/lib/types';

export function useComments(mint: string, sort: CommentSort = 'new') {
  const { publicKey } = useWallet();
  const viewer = publicKey?.toBase58();

  return useQuery({
    queryKey: ['comments', mint, sort, viewer],
    queryFn: () => fetchComments(mint, sort, viewer),
    staleTime: 30_000,
  });
}

export function usePostComment(mint: string) {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, walletAddress }: { text: string; walletAddress: string }) => {
      if (!publicKey) throw new Error('Wallet not connected');

      // Get the cached JWT — login if not already authenticated (no popup if cached)
      let token = getAuthToken(walletAddress);
      if (!token && signMessage) {
        token = await loginWithWallet(walletAddress, signMessage);
      }

      return postComment(mint, text, walletAddress, token);
    },
    onSuccess: (newComment: Comment) => {
      queryClient.setQueryData(
        ['comments', mint, 'new', publicKey?.toBase58()],
        (old: { comments: Comment[]; total: number } | undefined) => {
          if (!old) return { comments: [newComment], total: 1 };
          return { comments: [newComment, ...old.comments], total: old.total + 1 };
        }
      );
      queryClient.invalidateQueries({ queryKey: ['comments', mint, 'top'] });
    },
  });
}

export function useUpvoteComment(mint: string) {
  const { publicKey, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!publicKey) throw new Error('Wallet not connected');
      const walletAddress = publicKey.toBase58();

      // Get the cached JWT — login if not already authenticated (no popup if cached)
      let token = getAuthToken(walletAddress);
      if (!token && signMessage) {
        token = await loginWithWallet(walletAddress, signMessage);
      }

      return upvoteComment(commentId, walletAddress, token);
    },
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['comments', mint] });

      const sorts: CommentSort[] = ['new', 'top'];
      for (const sort of sorts) {
        queryClient.setQueryData(
          ['comments', mint, sort, publicKey?.toBase58()],
          (old: { comments: Comment[]; total: number } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              comments: old.comments.map((c) =>
                c.id === commentId
                  ? {
                      ...c,
                      hasUpvoted: !c.hasUpvoted,
                      upvotes: c.hasUpvoted ? c.upvotes - 1 : c.upvotes + 1,
                    }
                  : c
              ),
            };
          }
        );
      }
    },
  });
}
