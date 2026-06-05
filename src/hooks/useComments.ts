'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/providers/BscWalletProvider';
import { fetchComments, postComment, reactToComment } from '@/lib/api';
import { requireAuthToken } from '@/lib/session';
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
  const { address } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ text, walletAddress, parentId }: { text: string; walletAddress: string; parentId?: string }) => {
      if (!address) throw new Error('Wallet not connected');
      const token = requireAuthToken(walletAddress);
      return postComment(mint, text, walletAddress, token, parentId);
    },
    onSuccess: (newComment: Comment) => {
      queryClient.setQueryData(
        ['comments', mint, 'new', address],
        (old: { comments: Comment[]; total: number } | undefined) => {
          if (!old) return { comments: [newComment], total: 1 };
          if (newComment.parentId) {
            return {
              ...old,
              total: old.total + 1,
              comments: old.comments.map((comment) =>
                comment.id === newComment.parentId
                  ? {
                      ...comment,
                      replyCount: (comment.replyCount ?? comment.replies?.length ?? 0) + 1,
                      replies: [...(comment.replies ?? []), newComment],
                    }
                  : comment,
              ),
            };
          }
          return { comments: [newComment, ...old.comments], total: old.total + 1 };
        },
      );
      queryClient.invalidateQueries({ queryKey: ['comments', mint, 'top'] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
}

function updateCommentReaction(comments: Comment[], commentId: string, result: {
  likeCount: number;
  dislikeCount: number;
  viewerReaction: 'like' | 'dislike' | null;
  upvotes: number;
  hasUpvoted: boolean;
}): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, ...result };
    }
    if (comment.replies?.length) {
      return { ...comment, replies: updateCommentReaction(comment.replies, commentId, result) };
    }
    return comment;
  });
}

export function useReactToComment(mint: string) {
  const { address } = useWallet();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, type }: { commentId: string; type: 'like' | 'dislike' }) => {
      if (!address) throw new Error('Wallet not connected');
      const token = requireAuthToken(address);
      return reactToComment(commentId, address, type, token);
    },
    onSuccess: (result, { commentId }) => {
      for (const sort of ['new', 'top'] as CommentSort[]) {
        queryClient.setQueryData(
          ['comments', mint, sort, address],
          (old: { comments: Comment[]; total: number } | undefined) => {
            if (!old) return old;
            return { ...old, comments: updateCommentReaction(old.comments, commentId, result) };
          },
        );
      }
    },
  });
}
