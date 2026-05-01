import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Send, BookOpen, Users, ExternalLink, X } from 'lucide-react';
import studyGroupService, {
  type StudyGroupDetail,
  type GroupChatMessage,
} from '../services/studyGroupService';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';

interface Course {
  courseId: string;
  courseName: string;
}

export const StudyGroupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState<StudyGroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    studyGroupService.getDetail(id)
      .then((res) => setGroup(res.data?.data ?? null))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));

    studyGroupService.getChat(id)
      .then((res) => setMessages(res.data?.data ?? []))
      .catch(() => {});

    apiClient.get<{ data: Course[] }>('/api/courses')
      .then((res) => setAvailableCourses(res.data?.data ?? []))
      .catch(() => {});
  }, [id]);

  // Poll for new messages every 10 seconds
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      studyGroupService.getChat(id)
        .then((res) => setMessages(res.data?.data ?? []))
        .catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopyInviteCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async () => {
    if (!id || !messageInput.trim()) return;
    setSending(true);
    try {
      const res = await studyGroupService.sendMessage(id, messageInput.trim());
      if (res.data?.data) {
        setMessages((prev) => [...prev, res.data.data]);
        setMessageInput('');
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleShareCourse = async () => {
    if (!id || !selectedCourseId) return;
    try {
      await studyGroupService.shareCourse(id, selectedCourseId);
      const course = availableCourses.find((c) => c.courseId === selectedCourseId);
      if (course && group) {
        setGroup((g) => g ? {
          ...g,
          sharedCourses: [...g.sharedCourses, { courseId: course.courseId, courseName: course.courseName, sharedAt: new Date().toISOString() }],
        } : g);
        setSelectedCourseId('');
      }
    } catch {
      // ignore
    }
  };

  const handleUnshareCourse = async (courseId: string) => {
    if (!id) return;
    try {
      await studyGroupService.unshareCourse(id, courseId);
      setGroup((g) => g ? {
        ...g,
        sharedCourses: g.sharedCourses.filter((sc) => sc.courseId !== courseId),
      } : g);
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!group) return null;

  const roleColor = (role: string) =>
    role === 'owner' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/groups')} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-main">{group.name}</h1>
          {group.description && (
            <p className="text-sm text-text-muted mt-0.5">{group.description}</p>
          )}
        </div>
        {/* Invite code */}
        <button
          onClick={handleCopyInviteCode}
          className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          <span className="font-mono tracking-widest text-gray-600">{group.inviteCode}</span>
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: members + courses */}
        <div className="space-y-4">
          {/* Members */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Users size={15} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Members ({group.members.length})</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {group.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-gray-700 truncate">{m.userName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(m.role)}`}>
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Shared Courses */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <BookOpen size={15} className="text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Shared Courses</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {group.sharedCourses.length === 0 ? (
                <li className="px-4 py-3 text-xs text-gray-400">No shared courses yet.</li>
              ) : (
                group.sharedCourses.map((sc) => (
                  <li key={sc.courseId} className="flex items-center gap-1 px-3 py-2">
                    <button
                      onClick={() => navigate(`/courses/${sc.courseId}/study`)}
                      className="flex-1 flex items-center gap-2 text-sm text-gray-700 hover:text-teal-600 transition-colors text-left min-w-0"
                    >
                      <ExternalLink size={13} className="shrink-0 text-gray-400" />
                      <span className="truncate">{sc.courseName}</span>
                    </button>
                    <button
                      onClick={() => handleUnshareCourse(sc.courseId)}
                      className="shrink-0 p-1 text-gray-300 hover:text-red-400 transition-colors rounded"
                      title="Remove from group"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))
              )}
            </ul>
            {availableCourses.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-200"
                >
                  <option value="">Add a course...</option>
                  {availableCourses.map((c) => (
                    <option key={c.courseId} value={c.courseId}>{c.courseName}</option>
                  ))}
                </select>
                <button
                  onClick={handleShareCourse}
                  disabled={!selectedCourseId}
                  className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  Share
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right column: chat */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl flex flex-col" style={{ minHeight: '500px' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 shrink-0">
            <Send size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Group Chat</h2>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn = msg.userId === user?.id;
                return (
                  <div
                    key={msg.groupChatMessageId}
                    className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    {!isOwn && (
                      <span className="text-xs text-gray-400 mb-1">{msg.userName}</span>
                    )}
                    <div
                      className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                        isOwn
                          ? 'bg-teal-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
              placeholder="Type a message..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-200"
            />
            <button
              onClick={handleSendMessage}
              disabled={!messageInput.trim() || sending}
              className="flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
