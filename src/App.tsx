import { useState, useRef, useEffect } from 'react';
import { Search, MoreVertical, Send, Smile, Paperclip, Phone, Video, Users, Hash } from 'lucide-react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000', { autoConnect: false });
const GROUPS = [
  { id: "xyz1", name: 'React Devs', lastMessage: 'Vite is incredibly fast!', time: '10:42 AM', unread: 2, icon: <Hash size={20} className="text-blue-400" /> },
  { id: "xyz2", name: 'UI / UX Designers', lastMessage: 'Check out the new glassmorphism concepts.', time: 'Yesterday', unread: 0, icon: <Users size={20} className="text-pink-400" /> },
  { id: "xyz3", name: 'Backend Wizards', lastMessage: 'Database migration completed successfully.', time: 'Monday', unread: 5, icon: <Hash size={20} className="text-green-400" /> },
  { id: "xyz4", name: 'General Chat', lastMessage: 'Who wants coffee? ☕️', time: '12:00 PM', unread: 0, icon: <Users size={20} className="text-yellow-400" /> },
];

const INITIAL_MESSAGES: Record<string, { id: number, text: string, sender: string, time: string }[]> = {
  "React Devs": [
    { id: 1, text: 'Hello everyone!', sender: 'user', time: '10:40 AM' },
    { id: 2, text: 'Vite is incredibly fast!', sender: 'other', time: '10:42 AM' }
  ],
  "UI / UX Designers": [{ id: 1, text: 'Check out the new glassmorphism concepts.', sender: 'other', time: 'Yesterday' }],
  "Backend Wizards": [{ id: 1, text: 'Database migration completed successfully.', sender: 'other', time: 'Monday' }],
  "General Chat": [{ id: 1, text: 'Who wants coffee? ☕️', sender: 'other', time: '12:00 PM' }]
};

export default function App() {
  const [activeGroup, setActiveGroup] = useState(GROUPS[0]);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');

  // Track joined groups (groupId -> userName)
  const [joinedGroups, setJoinedGroups] = useState<Record<string, string>>({});
  const [joinName, setJoinName] = useState('');

  // Status tracking (room -> status string)
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const typingTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const joinedGroupsRef = useRef(joinedGroups);

  useEffect(() => {
    joinedGroupsRef.current = joinedGroups;
  }, [joinedGroups]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeGroup, joinedGroups]);

  useEffect(() => {
    socket.connect();

    socket.on("receive_message", (data) => {
      const { message, user, room } = data;
      setMessages((prev) => {
        const isUser = user === joinedGroupsRef.current[room];
        const newMessage = {
          id: Date.now() + Math.random(),
          text: message,
          sender: isUser ? 'user' : 'other',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return {
          ...prev,
          [room]: [...(prev[room] || []), newMessage]
        };
      });
    });

    socket.on("user_joined", (data) => {
      const { message, user: { room } } = data;
      setMessages((prev) => {
        const newMessage = {
          id: Date.now() + Math.random(),
          text: message,
          sender: 'system',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return {
          ...prev,
          [room]: [...(prev[room] || []), newMessage]
        };
      });
    });

    socket.on("user_left", (data) => {
      const { message, user: { room } } = data;
      setMessages((prev) => {
        const newMessage = {
          id: Date.now() + Math.random(),
          text: message,
          sender: 'system',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        return {
          ...prev,
          [room]: [...(prev[room] || []), newMessage]
        };
      });
    });

    socket.on("user_typing", (data) => {
      const { name, room } = data;
      // Extract original name from "Name is typing.." to check if it's us
      const userName = name.split(" is typing")[0];
      if (userName === joinedGroupsRef.current[room]) return;

      setStatusMap(prev => ({ ...prev, [room]: name }));

      if (typingTimeoutRef.current[room]) clearTimeout(typingTimeoutRef.current[room]);
      typingTimeoutRef.current[room] = setTimeout(() => {
        setStatusMap(prev => {
          if (prev[room] === name) {
            const next = { ...prev };
            delete next[room];
            return next;
          }
          return prev;
        });
      }, 3000);
    });

    socket.on("user_online", (data) => {
      const { name, room } = data;
      setStatusMap(prev => ({ ...prev, [room]: name }));

      setTimeout(() => {
        setStatusMap(prev => {
          if (prev[room] === name) {
            const next = { ...prev };
            delete next[room];
            return next;
          }
          return prev;
        });
      }, 5000);
    });

    const currentTimeouts = typingTimeoutRef.current;

    return () => {
      socket.disconnect();
      socket.off("receive_message");
      socket.off("user_joined");
      socket.off("user_left");
      socket.off("user_typing");
      socket.off("user_online");
      Object.values(currentTimeouts).forEach(clearTimeout);
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    socket.emit("send_message", {
      name: joinedGroups[activeGroup.name],
      room: activeGroup.name,
      message: inputMessage
    });

    setInputMessage('');
  };

  const handleJoinGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim()) return;

    setJoinedGroups(prev => ({ ...prev, [activeGroup.name]: joinName }));
    socket.emit("join_group", { name: joinName, room: activeGroup.name });
    socket.emit("user_online", { name: joinName, room: activeGroup.name });
    setJoinName('');
  };
  const leaveGroup = (room: string) => {
    socket.emit("leave_group", { name: joinedGroups[room], room });
    setJoinedGroups(prev => {
      const newGroups = { ...prev };
      delete newGroups[room];
      return newGroups;
    });
  };

  const hasJoined = !!joinedGroups[activeGroup.name];

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] text-gray-200 overflow-hidden font-sans selection:bg-emerald-500/30">
      <h1>Testing two </h1>
      {/* Sidebar Area */}
      <div className="w-full md:w-[350px] lg:w-[400px] flex-shrink-0 flex flex-col border-r border-white/5 bg-white/5 backdrop-blur-md relative z-10 transition-all">

        {/* Sidebar Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-black/10 backdrop-blur-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 p-[2px] shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full rounded-full bg-[#1e293b] flex items-center justify-center">
                <span className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">ME</span>
              </div>
            </div>
            <h1 className="font-semibold text-white tracking-wide">Chats</h1>
          </div>
          <div className="flex gap-4 text-gray-400">
            <button className="hover:text-emerald-400 transition-colors"><MoreVertical size={20} /></button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3">
          <div className="relative flex items-center bg-black/20 rounded-xl px-3 py-2 border border-white/5 focus-within:border-emerald-500/50 focus-within:bg-black/40 focus-within:shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-all group duration-300">
            <Search size={18} className="text-gray-500 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              placeholder="Search or start new chat"
              className="w-full bg-transparent outline-none border-none pl-3 text-sm text-gray-200 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Group List */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-4 space-y-1 px-2">
          {GROUPS.map((group) => (
            <div
              key={group.id}
              onClick={() => setActiveGroup(group)}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl cursor-pointer transition-all duration-300 transform active:scale-[0.98]
                ${activeGroup.id === group.id
                  ? 'bg-white/10 shadow-lg border border-white/10'
                  : 'hover:bg-white/5 border border-transparent hover:border-white/5'}`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-gray-800 to-gray-900 border border-white/10 shadow-inner overflow-hidden relative group-hover:from-gray-700 transition-colors`}>
                {group.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h2 className="text-base font-medium text-white truncate">{group.name}</h2>
                  <span className={`text-xs ${group.unread ? 'text-emerald-400 font-semibold' : 'text-gray-500'}`}>{group.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-400 truncate pr-2">
                    {joinedGroups[group.name] ? group.lastMessage : "Tap to join group"}
                  </p>
                  {group.unread > 0 && joinedGroups[group.name] && (
                    <span className="bg-emerald-500 text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center flex-shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.5)]">
                      {group.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative bg-[url('https://transparenttextures.com/patterns/cubes.png')] bg-opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/90 to-black/95 z-0"></div>

        {hasJoined ? (
          <>
            {/* Chat Header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/10 backdrop-blur-md z-10 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-gray-800 border border-white/10 shadow-inner`}>
                  {activeGroup.icon}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">{activeGroup.name}</h2>
                  <div className="flex items-center gap-2">
                    {statusMap[activeGroup.name] ? (
                      <p className="text-xs text-emerald-400 font-medium animate-pulse">{statusMap[activeGroup.name]}</p>
                    ) : (
                      <p className="text-xs text-white/50 tracking-wide">
                        {joinedGroups[activeGroup.name]}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-5 text-gray-400">
                <button onClick={() => { leaveGroup(activeGroup.name) }} className="hover:text-emerald-400 transition-colors transform hover:scale-110 active:scale-95">Leave Group</button>
                <button className="hover:text-emerald-400 transition-colors transform hover:scale-110 active:scale-95"><Video size={20} /></button>
                <button className="hover:text-emerald-400 transition-colors transform hover:scale-110 active:scale-95"><Phone size={20} /></button>
                <div className="w-px h-6 bg-white/10 mx-1"></div>
                <button className="hover:text-emerald-400 transition-colors transform hover:scale-110 active:scale-95"><Search size={20} /></button>
                <button className="hover:text-white transition-colors transform hover:scale-110 active:scale-95"><MoreVertical size={20} /></button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 z-10 custom-scrollbar scroll-smooth">
              {(messages[activeGroup.name] || []).map((msg) => {
                if (msg.sender === 'system') {
                  return (
                    <div key={msg.id} className="flex justify-center animate-in fade-in duration-300">
                      <div className="bg-black/30 backdrop-blur-md rounded-full px-4 py-1.5 text-xs text-gray-400 font-medium tracking-wide">
                        {msg.text}
                      </div>
                    </div>
                  );
                }

                const isUser = msg.sender === 'user';
                return (
                  <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-lg backdrop-blur-sm relative group transition-all
                      ${isUser
                        ? 'bg-gradient-to-br from-emerald-600/90 to-emerald-700/90 rounded-br-sm text-white border border-emerald-400/30 shadow-emerald-900/20'
                        : 'bg-white/10 rounded-bl-sm text-gray-100 border border-white/5 shadow-black/20 hover:bg-white/15'}`
                    }>
                      <p className="text-[15px] leading-relaxed tracking-wide text-pretty">{msg.text}</p>
                      <span className={`text-[10.5px] mt-1.5 flex justify-end opacity-70 tracking-widest font-medium ${isUser ? 'text-emerald-100' : 'text-gray-400'}`}>
                        {msg.time}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} className="h-2" />
            </div>

            {/* Chat Input */}

            <div className="p-4 bg-black/20 backdrop-blur-xl border-t border-white/5 z-10">
              <form onSubmit={handleSendMessage} className="flex items-center gap-3 max-w-5xl mx-auto">
                <button type="button" className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 p-2.5 rounded-full transition-all duration-200">
                  <Smile size={24} />
                </button>
                <button type="button" className="text-gray-400 hover:text-emerald-400 hover:bg-emerald-400/10 p-2.5 rounded-full transition-all duration-200">
                  <Paperclip size={22} />
                </button>
                <div className="flex-1 bg-black/40 rounded-full border border-white/10 px-5 py-3 flex items-center focus-within:border-emerald-500/50 focus-within:bg-black/60 transition-all duration-300 shadow-inner group">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => {
                      setInputMessage(e.target.value);
                      if (joinedGroups[activeGroup.name]) {
                        socket.emit("user_typing", {
                          name: joinedGroups[activeGroup.name],
                          room: activeGroup.name
                        });
                      }
                    }}
                    placeholder="Message..."
                    className="w-full bg-transparent outline-none border-none text-gray-200 placeholder-gray-500 text-[15px]"
                  />
                </div>
                {inputMessage.trim() ? (
                  <button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-400 text-white p-3.5 rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center justify-center pointer-events-auto"
                  >
                    <Send size={20} className="ml-0.5" />
                  </button>
                ) : (
                  <button type="button" className="bg-white/5 hover:bg-white/10 text-gray-400 p-3.5 rounded-full transition-all duration-300 flex items-center justify-center pointer-events-none opacity-50 relative">
                    <Send size={20} className="ml-0.5" />
                  </button>
                )}
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center z-10 p-6 animate-in fade-in duration-500">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl max-w-md w-full text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-gray-800 border border-white/10 shadow-inner mx-auto mb-6">
                {activeGroup.icon}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Join {activeGroup.name}</h2>
              <p className="text-gray-400 mb-8 text-sm">Please enter your name to join this group chat.</p>

              <form onSubmit={handleJoinGroup} className="flex flex-col gap-4">
                <input
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-black/40 rounded-xl border border-white/10 px-5 py-3 text-gray-200 placeholder-gray-500 focus:border-emerald-500/50 focus:bg-black/60 transition-all duration-300 outline-none"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 px-5 rounded-xl transition-all duration-300 transform active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                >
                  Join Group
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
