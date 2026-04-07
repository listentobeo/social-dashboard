import { Heart, MessageCircle, Share2, Eye, ExternalLink } from 'lucide-react';

export default function PostCard({ post, rank }) {
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-2xl p-4 flex gap-4">
      {rank && (
        <span className="text-gray-600 font-bold text-lg w-6 flex-shrink-0">{rank}</span>
      )}

      {post.thumbnail_url && (
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-dark-600">
          <img
            src={post.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-gray-300 text-sm line-clamp-2 mb-2">
          {post.caption || '(no caption)'}
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Heart size={12} className="text-red-400" />
            {post.likes_count?.toLocaleString() || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle size={12} className="text-blue-400" />
            {post.comments_count?.toLocaleString() || 0}
          </span>
          {post.views_count > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={12} className="text-purple-400" />
              {post.views_count?.toLocaleString()}
            </span>
          )}
          <span className="ml-auto text-accent font-semibold">
            {parseFloat(post.engagement_rate || 0).toFixed(2)}% eng
          </span>
          {post.post_url && (
            <a href={post.post_url} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
