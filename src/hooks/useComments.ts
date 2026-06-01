'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/BscWalletProvider';
import { fetchComments, postComment, upvoteComment } from '@/lib/api';
import { getAuthToken, loginWithWallet } from '@/lib/session';
import type { CommentSort, Comment } from '@/lib/types';

export function useComments(mint: string, sort: CommentSort = 'new') {
  const { address } = useWallet();
  return useQuery({
    queryKey: ['comments', mint, sort, address],
    queryFn: () => fetchComments(mint, sort, address ?? undefined),
    staleTime: 30_000,
  });
}

export function usePostComment(mint: string) {
  const { address, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, walletAddress }: { text: string; walletAddress: string }) => {
      if (!address || !signMessage) throw new Error('Wallet not connected');
      let token = getAuthToken(walletAddress);
      if (!token) token = await loginWithWallet(walletAddress, signMessage);
      return postComment(mint, text, walletAddress, token);
    },
    onSuccess: (newComment: Comment) => {
      queryClient.setQueryData(
        ['comments', mint, 'new', address],
        (old: { comments: Comment[]; total: number } | undefined) => {
          if (!old) return { comments: [newComment], total: 1 };
          return { comments: [newComment, ...old.comments], total: old.total + 1 };
        },
      );
      queryClient.invalidateQueries({ queryKey: ['comments', mint, 'top'] });
    },
  });
}

export function useUpvoteComment(mint: string) {
  const { address, signMessage } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (commentId: string) => {
      if (!address || !signMessage) throw new Error('Wallet not connected');
      let token = getAuthToken(address);
      if (!token) token = await loginWithWallet(address, signMessage);
      return upvoteComment(commentId, address, token);
    },
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey: ['comments', mint] });
      for (const sort of ['new', 'top'] as CommentSort[]) {
        queryClient.setQueryData(
          ['comments', mint, sort, address],
          (old: { comments: Comment[]; total: number } | undefined) => {
            if (!old) return old;
            return {
              ...old,
              comments: old.comments.map((comment) =>
                comment.id === commentId
                  ? {
                      ...comment,
                      hasUpvoted: !comment.hasUpvoted,
                      upvotes: comment.hasUpvoted ? comment.upvotes - 1 : comment.upvotes + 1,
                    }
                  : comment,
              ),
            };
          },
        );
      }
    },
  });
}
