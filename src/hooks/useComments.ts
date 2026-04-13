'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchComments, postComment, upvoteComment } from '@/lib/api';
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
      if (!publicKey || !signMessage) throw new Error('Wallet not connected');

      const timestamp = Date.now();
      const message = `ACTION:COMMENT|DATA:${text.slice(0, 20)}|TIMESTAMP:${timestamp}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(sig).toString('base64');

      return postComment(mint, text, walletAddress, signature, timestamp);
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
      if (!publicKey || !signMessage) throw new Error('Wallet not connected');

      const timestamp = Date.now();
      const message = `ACTION:UPVOTE|DATA:${commentId}|TIMESTAMP:${timestamp}`;
      const sig = await signMessage(new TextEncoder().encode(message));
      const signature = Buffer.from(sig).toString('base64');

      return upvoteComment(commentId, publicKey.toBase58(), signature, timestamp);
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
