import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchComments, postComment, upvoteComment } from '@/lib/api';
import type { CommentSort, Comment } from '@/lib/types';

export function useComments(mint: string, sort: CommentSort = 'new') {
  return useQuery({
    queryKey: ['comments', mint, sort],
    queryFn: () => fetchComments(mint, sort),
    staleTime: 30_000,
  });
}

export function usePostComment(mint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ text, walletAddress }: { text: string; walletAddress: string }) =>
      postComment(mint, text, walletAddress),
    onSuccess: (newComment: Comment) => {
      // Optimistic update — prepend the new comment
      queryClient.setQueryData(
        ['comments', mint, 'new'],
        (old: { comments: Comment[]; total: number } | undefined) => {
          if (!old) return { comments: [newComment], total: 1 };
          return {
            comments: [newComment, ...old.comments],
            total: old.total + 1,
          };
        }
      );
      // Also invalidate 'top' sort
      queryClient.invalidateQueries({ queryKey: ['comments', mint, 'top'] });
    },
  });
}

export function useUpvoteComment(mint: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => upvoteComment(commentId),
    onMutate: async (commentId: string) => {
      // Optimistic update — toggle upvote
      await queryClient.cancelQueries({ queryKey: ['comments', mint] });

      const sorts: CommentSort[] = ['new', 'top'];
      for (const sort of sorts) {
        queryClient.setQueryData(
          ['comments', mint, sort],
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
